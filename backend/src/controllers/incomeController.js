const { query, transaction } = require('../config/db');
const { logAudit } = require('../services/auditService');

// Get All Income & Advances
async function getIncomeTransactions(req, res, next) {
    try {
        const { startDate, endDate, projectId, isAdvance } = req.query;

        let sql = `
            SELECT inc.*,
                   p.name as project_name,
                   p.project_code,
                   inv.invoice_number,
                   u.full_name as receiver_name
            FROM income_transactions inc
            LEFT JOIN projects p ON inc.project_id = p.id
            LEFT JOIN invoices inv ON inc.invoice_id = inv.id
            LEFT JOIN users u ON inc.received_by = u.id
            WHERE 1=1
        `;
        const params = [];

        // Role restriction: Admin sees all; User sees own records or assigned projects
        if (req.user.role !== 'Admin') {
            sql += ` AND (inc.received_by = $${params.length + 1} OR inc.project_id IN (SELECT project_id FROM project_members WHERE user_id = $${params.length + 1}))`;
            params.push(req.user.id);
        }

        if (startDate) {
            params.push(startDate);
            sql += ` AND inc.payment_date >= $${params.length}`;
        }
        if (endDate) {
            params.push(endDate);
            sql += ` AND inc.payment_date <= $${params.length}`;
        }
        if (projectId && projectId !== 'All') {
            params.push(projectId);
            sql += ` AND inc.project_id = $${params.length}`;
        }
        if (isAdvance !== undefined && isAdvance !== 'All') {
            params.push(isAdvance === 'true');
            sql += ` AND inc.is_advance = $${params.length}`;
        }

        sql += ` ORDER BY inc.payment_date DESC, inc.id DESC`;

        const result = await query(sql, params);

        const totalIncome = result.rows.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        const totalAdvances = result.rows
            .filter((item) => item.is_advance)
            .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

        res.json({
            success: true,
            count: result.rows.length,
            total_income: totalIncome,
            total_advances: totalAdvances,
            data: result.rows,
        });
    } catch (err) {
        next(err);
    }
}

// Record Income or Advance
async function recordIncome(req, res, next) {
    try {
        const {
            project_id,
            invoice_id,
            project_type,
            project_details,
            client_name,
            amount,
            payment_date,
            payment_method,
            transaction_reference,
            is_advance,
            notes,
        } = req.body;

        if (!client_name || !amount || !payment_date || !payment_method) {
            return res.status(400).json({
                success: false,
                message: 'Client name, amount, payment date, and payment method are required.',
            });
        }

        const isAdv = is_advance === true || is_advance === 'true';
        const parsedAmount = parseFloat(amount);

        // User permission checks
        if (project_id && req.user.role !== 'Admin') {
            const memberCheck = await query(
                'SELECT can_add_income FROM project_members WHERE project_id = $1 AND user_id = $2',
                [project_id, req.user.id]
            );
            if (memberCheck.rows.length === 0 || !memberCheck.rows[0].can_add_income) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to add income to this project.',
                });
            }
        }

        // Auto-generate income code
        const countRes = await query('SELECT COUNT(*) as count FROM income_transactions');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 101;
        const incomeCode = `INC-${nextNum}`;

        const proofAttachment = req.file ? `/uploads/${req.file.filename}` : null;

        const newRecord = await transaction(async (client) => {
            const incRes = await client.query(
                `INSERT INTO income_transactions (income_code, project_id, invoice_id, project_type, project_details, client_name, amount, payment_date, payment_method, transaction_reference, is_advance, is_project_income, proof_attachment, notes, received_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
                [
                    incomeCode,
                    project_id ? parseInt(project_id, 10) : null,
                    invoice_id ? parseInt(invoice_id, 10) : null,
                    project_type ? project_type.trim() : null,
                    project_details ? project_details.trim() : null,
                    client_name.trim(),
                    parsedAmount,
                    payment_date,
                    payment_method,
                    transaction_reference || null,
                    isAdv,
                    Boolean(project_id || project_type),
                    proofAttachment,
                    notes || null,
                    req.user.id,
                ]
            );

            // If advance on a project, update project's advance_received
            if (isAdv && project_id) {
                await client.query(
                    'UPDATE projects SET advance_received = advance_received + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [parsedAmount, project_id]
                );
            }

            // If linked to an invoice, record payment against invoice and update invoice status
            if (invoice_id) {
                const payCountRes = await client.query('SELECT COUNT(*) as count FROM payments');
                const payCode = `PAY-${parseInt(payCountRes.rows[0].count, 10) + 101}`;

                await client.query(
                    `INSERT INTO payments (payment_code, invoice_id, amount, payment_date, payment_method, transaction_reference, payment_proof, notes, recorded_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        payCode,
                        invoice_id,
                        parsedAmount,
                        payment_date,
                        payment_method,
                        transaction_reference || null,
                        proofAttachment,
                        notes || 'Payment recorded via Income module',
                        req.user.id,
                    ]
                );

                // Check invoice total vs payments
                const invRes = await client.query(
                    `SELECT total_amount, advance_deduction,
                            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = $1) as total_paid
                     FROM invoices WHERE id = $1`,
                    [invoice_id]
                );

                if (invRes.rows.length > 0) {
                    const inv = invRes.rows[0];
                    const netDue = parseFloat(inv.total_amount) - parseFloat(inv.advance_deduction);
                    const totalPaid = parseFloat(inv.total_paid);

                    let newStatus = 'Partially Paid';
                    if (totalPaid >= netDue) {
                        newStatus = 'Paid';
                    }

                    await client.query(
                        'UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                        [newStatus, invoice_id]
                    );
                }
            }

            return incRes.rows[0];
        });

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: isAdv ? 'RECORD_ADVANCE' : 'RECORD_INCOME',
            entityType: 'income',
            entityId: newRecord.id,
            details: `Recorded $${newRecord.amount} from ${newRecord.client_name}`,
            req,
        });

        res.status(201).json({ success: true, message: 'Income transaction recorded successfully.', data: newRecord });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getIncomeTransactions,
    recordIncome,
};
