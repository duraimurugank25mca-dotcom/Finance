const { query, transaction } = require('../config/db');
const { logAudit } = require('../services/auditService');

// Get All Projects (Admin: all, User: assigned projects only)
async function getProjects(req, res, next) {
    try {
        let sql = `
            SELECT p.*,
                COALESCE(u.full_name, 'System') as created_by_name,
                (SELECT COALESCE(SUM(amount), 0) FROM income_transactions WHERE project_id = p.id) as total_income_received,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE project_id = p.id) as total_expenses,
                (SELECT COUNT(*) FROM invoices WHERE project_id = p.id) as total_invoices,
                (SELECT COUNT(*) FROM attachments WHERE entity_type = 'project' AND entity_id = p.id) as total_attachments
            FROM projects p
            LEFT JOIN users u ON p.created_by = u.id
        `;

        const params = [];
        if (req.user.role !== 'Admin') {
            sql += `
                INNER JOIN project_members pm ON p.id = pm.project_id
                WHERE pm.user_id = $1
            `;
            params.push(req.user.id);
        }

        sql += ` ORDER BY p.id DESC`;

        const result = await query(sql, params);

        // Compute project-level financial metrics
        const projects = result.rows.map((p) => {
            const contract = parseFloat(p.contract_amount || 0);
            const income = parseFloat(p.total_income_received || 0);
            const expense = parseFloat(p.total_expenses || 0);
            const advance = parseFloat(p.advance_received || 0);
            const profit = income - expense;
            const pendingPayment = Math.max(0, contract - income);

            return {
                ...p,
                contract_amount: contract,
                advance_received: advance,
                total_income_received: income,
                total_expenses: expense,
                project_profit: profit,
                pending_payment: pendingPayment,
            };
        });

        res.json({ success: true, count: projects.length, data: projects });
    } catch (err) {
        next(err);
    }
}

// Get Single Project Details (including statements, invoices, members, attachments)
async function getProjectById(req, res, next) {
    try {
        const { id } = req.params;

        // Verify access if user
        if (req.user.role !== 'Admin') {
            const memberCheck = await query(
                'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Access denied. You are not assigned to this project.' });
            }
        }

        const projectRes = await query(
            `SELECT p.*, COALESCE(u.full_name, 'System') as created_by_name
             FROM projects p
             LEFT JOIN users u ON p.created_by = u.id
             WHERE p.id = $1`,
            [id]
        );

        if (projectRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        const project = projectRes.rows[0];

        // Fetch assigned members
        const membersRes = await query(
            `SELECT pm.*, u.full_name, u.email, u.role
             FROM project_members pm
             JOIN users u ON pm.user_id = u.id
             WHERE pm.project_id = $1`,
            [id]
        );

        // Fetch expenses
        const expensesRes = await query(
            `SELECT e.*, u.full_name as recorder_name
             FROM expenses e
             LEFT JOIN users u ON e.user_id = u.id
             WHERE e.project_id = $1
             ORDER BY e.expense_date DESC`,
            [id]
        );

        // Fetch invoices
        const invoicesRes = await query(
            `SELECT i.*, 
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = i.id) as payments_received
             FROM invoices i
             WHERE i.project_id = $1
             ORDER BY i.invoice_date DESC`,
            [id]
        );

        // Fetch income & advances
        const incomeRes = await query(
            `SELECT inc.*, u.full_name as receiver_name
             FROM income_transactions inc
             LEFT JOIN users u ON inc.received_by = u.id
             WHERE inc.project_id = $1
             ORDER BY inc.payment_date DESC`,
            [id]
        );

        // Fetch attachments
        const attachmentsRes = await query(
            `SELECT a.*, u.full_name as uploader_name
             FROM attachments a
             LEFT JOIN users u ON a.uploaded_by = u.id
             WHERE a.entity_type = 'project' AND a.entity_id = $1
             ORDER BY a.created_at DESC`,
            [id]
        );

        // Computations
        const contractAmount = parseFloat(project.contract_amount || 0);
        const totalIncome = incomeRes.rows.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        const totalExpenses = expensesRes.rows.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        const advanceReceived = parseFloat(project.advance_received || 0);
        const projectProfit = totalIncome - totalExpenses;
        const pendingPayment = Math.max(0, contractAmount - totalIncome);

        res.json({
            success: true,
            data: {
                ...project,
                contract_amount: contractAmount,
                advance_received: advanceReceived,
                total_income: totalIncome,
                total_expenses: totalExpenses,
                project_profit: projectProfit,
                pending_payment: pendingPayment,
                members: membersRes.rows,
                expenses: expensesRes.rows,
                invoices: invoicesRes.rows,
                income_transactions: incomeRes.rows,
                attachments: attachmentsRes.rows,
            },
        });
    } catch (err) {
        next(err);
    }
}

// Create Project (Admin or User with can_create_project)
async function createProject(req, res, next) {
    try {
        if (req.user.role !== 'Admin' && !req.user.can_create_project) {
            return res.status(403).json({ success: false, message: 'You do not have permission to create projects.' });
        }

        const {
            name,
            client_name,
            client_email,
            client_phone,
            client_address,
            description,
            start_date,
            status,
            contract_amount,
            advance_received,
            notes,
            member_ids,
        } = req.body;

        if (!name || !client_name || !start_date) {
            return res.status(400).json({ success: false, message: 'Project Name, Client Name, and Start Date are required.' });
        }

        // Auto-generate project code
        const countRes = await query('SELECT COUNT(*) as count FROM projects');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 101;
        const projectCode = `PRJ-${nextNum}`;

        const contract = parseFloat(contract_amount || 0);
        const advance = parseFloat(advance_received || 0);

        const project = await transaction(async (client) => {
            const insertRes = await client.query(
                `INSERT INTO projects (project_code, name, client_name, client_email, client_phone, client_address, description, start_date, status, contract_amount, advance_received, notes, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                [
                    projectCode,
                    name.trim(),
                    client_name.trim(),
                    client_email || null,
                    client_phone || null,
                    client_address || null,
                    description || null,
                    start_date,
                    status || 'In Progress',
                    contract,
                    advance,
                    notes || null,
                    req.user.id,
                ]
            );

            const newProj = insertRes.rows[0];

            // If advance was received at project creation, record as an income transaction
            if (advance > 0) {
                const incCodeRes = await client.query('SELECT COUNT(*) as count FROM income_transactions');
                const incCode = `INC-${String(parseInt(incCodeRes.rows[0].count, 10) + 1).padStart(3, '0')}`;
                await client.query(
                    `INSERT INTO income_transactions (income_code, project_id, client_name, amount, payment_date, payment_method, is_advance, is_project_income, notes, received_by)
                     VALUES ($1, $2, $3, $4, $5, 'Bank Transfer', TRUE, TRUE, 'Initial project advance payment', $6)`,
                    [incCode, newProj.id, newProj.client_name, advance, start_date, req.user.id]
                );
            }

            // Assign members if provided
            if (Array.isArray(member_ids)) {
                for (const uId of member_ids) {
                    await client.query(
                        `INSERT INTO project_members (project_id, user_id, can_add_income, can_add_expense, can_view_bills)
                         VALUES ($1, $2, TRUE, TRUE, TRUE) ON CONFLICT DO NOTHING`,
                        [newProj.id, uId]
                    );
                }
            }

            return newProj;
        });

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'CREATE_PROJECT',
            entityType: 'project',
            entityId: project.id,
            details: `Created project ${project.project_code}: ${project.name}`,
            req,
        });

        res.status(201).json({ success: true, message: 'Project created successfully.', data: project });
    } catch (err) {
        next(err);
    }
}

// Update Project
async function updateProject(req, res, next) {
    try {
        const { id } = req.params;

        if (req.user.role !== 'Admin' && !req.user.can_edit_records) {
            return res.status(403).json({ success: false, message: 'Permission denied. You cannot edit project records.' });
        }

        const {
            name,
            client_name,
            client_email,
            client_phone,
            client_address,
            description,
            start_date,
            status,
            contract_amount,
            advance_received,
            notes,
        } = req.body;

        const updateRes = await query(
            `UPDATE projects SET
                name = COALESCE($1, name),
                client_name = COALESCE($2, client_name),
                client_email = COALESCE($3, client_email),
                client_phone = COALESCE($4, client_phone),
                client_address = COALESCE($5, client_address),
                description = COALESCE($6, description),
                start_date = COALESCE($7, start_date),
                status = COALESCE($8, status),
                contract_amount = COALESCE($9, contract_amount),
                advance_received = COALESCE($10, advance_received),
                notes = COALESCE($11, notes),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $12 RETURNING *`,
            [
                name,
                client_name,
                client_email,
                client_phone,
                client_address,
                description,
                start_date,
                status,
                contract_amount ? parseFloat(contract_amount) : null,
                advance_received ? parseFloat(advance_received) : null,
                notes,
                id,
            ]
        );

        if (updateRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'UPDATE_PROJECT',
            entityType: 'project',
            entityId: id,
            details: `Updated project ID ${id}`,
            req,
        });

        res.json({ success: true, message: 'Project updated successfully.', data: updateRes.rows[0] });
    } catch (err) {
        next(err);
    }
}

// Delete Project (Admin only or user with can_delete_records)
async function deleteProject(req, res, next) {
    try {
        const { id } = req.params;

        if (req.user.role !== 'Admin' && !req.user.can_delete_records) {
            return res.status(403).json({ success: false, message: 'Permission denied. Only Administrators can delete projects.' });
        }

        const delRes = await query('DELETE FROM projects WHERE id = $1 RETURNING project_code, name', [id]);
        if (delRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'DELETE_PROJECT',
            entityType: 'project',
            entityId: id,
            details: `Deleted project ${delRes.rows[0].project_code}`,
            req,
        });

        res.json({ success: true, message: 'Project deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

// Manage Project Members (Admin only)
async function assignProjectMember(req, res, next) {
    try {
        const { id } = req.params;
        const { user_id, can_add_income, can_add_expense, can_view_bills } = req.body;

        if (!user_id) {
            return res.status(400).json({ success: false, message: 'user_id is required.' });
        }

        await query(
            `INSERT INTO project_members (project_id, user_id, can_add_income, can_add_expense, can_view_bills)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (project_id, user_id) DO UPDATE SET
                can_add_income = EXCLUDED.can_add_income,
                can_add_expense = EXCLUDED.can_add_expense,
                can_view_bills = EXCLUDED.can_view_bills`,
            [id, user_id, can_add_income !== false, can_add_expense !== false, can_view_bills !== false]
        );

        res.json({ success: true, message: 'Project member permissions updated.' });
    } catch (err) {
        next(err);
    }
}

// Remove Project Member (Admin only)
async function removeProjectMember(req, res, next) {
    try {
        const { id, userId } = req.params;
        await query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [id, userId]);
        res.json({ success: true, message: 'Member removed from project.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    assignProjectMember,
    removeProjectMember,
};
