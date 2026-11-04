const { query } = require('../config/db');
const { logAudit } = require('../services/auditService');

// Get Expenses with Filters & Totals
async function getExpenses(req, res, next) {
    try {
        const { startDate, endDate, category, projectId, minAmount, maxAmount } = req.query;

        let sql = `
            SELECT e.*,
                   p.name as project_name,
                   p.project_code,
                   u.full_name as user_full_name
            FROM expenses e
            LEFT JOIN projects p ON e.project_id = p.id
            LEFT JOIN users u ON e.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        // Role restriction: Admin sees all; User sees own records or assigned projects
        if (req.user.role !== 'Admin') {
            sql += ` AND (e.user_id = $${params.length + 1} OR e.project_id IN (SELECT project_id FROM project_members WHERE user_id = $${params.length + 1}))`;
            params.push(req.user.id);
        }

        if (startDate) {
            params.push(startDate);
            sql += ` AND e.expense_date >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            sql += ` AND e.expense_date <= $${params.length}`;
        }
        if (category && category !== 'All') {
            params.push(category);
            sql += ` AND e.category_name = $${params.length}`;
        }
        if (projectId && projectId !== 'All') {
            params.push(projectId);
            sql += ` AND e.project_id = $${params.length}`;
        }
        if (minAmount) {
            params.push(parseFloat(minAmount));
            sql += ` AND e.amount >= $${params.length}`;
        }
        if (maxAmount) {
            params.push(parseFloat(maxAmount));
            sql += ` AND e.amount <= $${params.length}`;
        }

        sql += ` ORDER BY e.expense_date DESC, e.id DESC`;

        const result = await query(sql, params);

        // Calculate Totals
        const totalAmount = result.rows.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

        // Group by category summary
        const categoryBreakdown = {};
        result.rows.forEach((item) => {
            const cat = item.category_name;
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + parseFloat(item.amount || 0);
        });

        res.json({
            success: true,
            count: result.rows.length,
            total_amount: totalAmount,
            category_breakdown: categoryBreakdown,
            data: result.rows,
        });
    } catch (err) {
        next(err);
    }
}

// Get Expense Categories
async function getCategories(req, res, next) {
    try {
        const result = await query('SELECT * FROM expense_categories ORDER BY name ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        next(err);
    }
}

// Create Expense
async function createExpense(req, res, next) {
    try {
        const {
            category_name,
            description,
            amount,
            expense_date,
            payment_method,
            project_id,
            paid_by,
            notes,
        } = req.body;

        if (!category_name || !description || !amount || !expense_date || !payment_method || !paid_by) {
            return res.status(400).json({
                success: false,
                message: 'Category, description, amount, expense date, payment method, and paid by are required.',
            });
        }

        // If project_id provided and user is not Admin, check if user is assigned to project and can add expense
        if (project_id && req.user.role !== 'Admin') {
            const memberCheck = await query(
                'SELECT can_add_expense FROM project_members WHERE project_id = $1 AND user_id = $2',
                [project_id, req.user.id]
            );
            if (memberCheck.rows.length === 0 || !memberCheck.rows[0].can_add_expense) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to add expenses to this project.',
                });
            }
        }

        // Auto-generate expense code
        const countRes = await query('SELECT COUNT(*) as count FROM expenses');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 101;
        const expenseCode = `EXP-${nextNum}`;

        const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const insertRes = await query(
            `INSERT INTO expenses (expense_code, category_name, description, amount, expense_date, payment_method, project_id, paid_by, user_id, receipt_url, notes, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'Approved') RETURNING *`,
            [
                expenseCode,
                category_name,
                description.trim(),
                parseFloat(amount),
                expense_date,
                payment_method,
                project_id ? parseInt(project_id, 10) : null,
                paid_by.trim(),
                req.user.id,
                receiptUrl,
                notes || null,
            ]
        );

        const newExpense = insertRes.rows[0];

        // Also add attachment record if file uploaded
        if (req.file) {
            await query(
                `INSERT INTO attachments (entity_type, entity_id, file_name, original_name, file_path, file_type, file_size, uploaded_by)
                 VALUES ('expense', $1, $2, $3, $4, $5, $6, $7)`,
                [
                    newExpense.id,
                    req.file.filename,
                    req.file.originalname,
                    receiptUrl,
                    req.file.mimetype,
                    req.file.size,
                    req.user.id,
                ]
            );
        }

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'CREATE_EXPENSE',
            entityType: 'expense',
            entityId: newExpense.id,
            details: `Created expense ${newExpense.expense_code}: $${newExpense.amount} for ${newExpense.category_name}`,
            req,
        });

        res.status(201).json({ success: true, message: 'Expense recorded successfully.', data: newExpense });
    } catch (err) {
        next(err);
    }
}

// Update Expense
async function updateExpense(req, res, next) {
    try {
        const { id } = req.params;

        // Verify permissions
        const expCheck = await query('SELECT * FROM expenses WHERE id = $1', [id]);
        if (expCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Expense record not found.' });
        }

        const existingExp = expCheck.rows[0];

        if (req.user.role !== 'Admin') {
            if (!req.user.can_edit_records || existingExp.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied. You can only edit your own expenses if permitted by an Administrator.',
                });
            }
        }

        const {
            category_name,
            description,
            amount,
            expense_date,
            payment_method,
            project_id,
            paid_by,
            notes,
        } = req.body;

        const receiptUrl = req.file ? `/uploads/${req.file.filename}` : existingExp.receipt_url;

        const updateRes = await query(
            `UPDATE expenses SET
                category_name = COALESCE($1, category_name),
                description = COALESCE($2, description),
                amount = COALESCE($3, amount),
                expense_date = COALESCE($4, expense_date),
                payment_method = COALESCE($5, payment_method),
                project_id = COALESCE($6, project_id),
                paid_by = COALESCE($7, paid_by),
                receipt_url = COALESCE($8, receipt_url),
                notes = COALESCE($9, notes),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $10 RETURNING *`,
            [
                category_name,
                description,
                amount ? parseFloat(amount) : null,
                expense_date,
                payment_method,
                project_id !== undefined ? (project_id ? parseInt(project_id, 10) : null) : null,
                paid_by,
                receiptUrl,
                notes,
                id,
            ]
        );

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'UPDATE_EXPENSE',
            entityType: 'expense',
            entityId: id,
            details: `Updated expense ${existingExp.expense_code}`,
            req,
        });

        res.json({ success: true, message: 'Expense updated successfully.', data: updateRes.rows[0] });
    } catch (err) {
        next(err);
    }
}

// Delete Expense
async function deleteExpense(req, res, next) {
    try {
        const { id } = req.params;

        const expCheck = await query('SELECT * FROM expenses WHERE id = $1', [id]);
        if (expCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Expense not found.' });
        }

        const exp = expCheck.rows[0];

        if (req.user.role !== 'Admin') {
            if (!req.user.can_delete_records || exp.user_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied. You can only delete records when explicitly permitted by an Administrator.',
                });
            }
        }

        await query('DELETE FROM expenses WHERE id = $1', [id]);

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'DELETE_EXPENSE',
            entityType: 'expense',
            entityId: id,
            details: `Deleted expense ${exp.expense_code}`,
            req,
        });

        res.json({ success: true, message: 'Expense record deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getExpenses,
    getCategories,
    createExpense,
    updateExpense,
    deleteExpense,
};
