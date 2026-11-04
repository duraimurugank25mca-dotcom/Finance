const { query, transaction } = require('../config/db');
const { logAudit } = require('../services/auditService');

// Get Partner Financial Summary (R, V, D & Combined)
async function getPartnerSummary(req, res, next) {
    try {
        const transRes = await query(`
            SELECT entry_type, split_type, partner_name, total_amount, amount_r, amount_v, amount_d
            FROM partner_transactions
        `);

        let incomeTotal = 0;
        let expenseTotal = 0;

        let rIncome = 0;
        let rExpense = 0;

        let vIncome = 0;
        let vExpense = 0;

        let dIncome = 0;
        let dExpense = 0;

        transRes.rows.forEach((row) => {
            const tot = parseFloat(row.total_amount || 0);
            const ar = parseFloat(row.amount_r || 0);
            const av = parseFloat(row.amount_v || 0);
            const ad = parseFloat(row.amount_d || 0);

            if (row.entry_type === 'Income') {
                incomeTotal += tot;
                rIncome += ar;
                vIncome += av;
                dIncome += ad;
            } else if (row.entry_type === 'Expense') {
                expenseTotal += tot;
                rExpense += ar;
                vExpense += av;
                dExpense += ad;
            }
        });

        res.json({
            success: true,
            data: {
                combined: {
                    total_income: incomeTotal,
                    total_expense: expenseTotal,
                    net_balance: incomeTotal - expenseTotal,
                },
                partners: {
                    R: {
                        name: 'Partner R',
                        code: 'R',
                        total_income: rIncome,
                        total_expense: rExpense,
                        net_balance: rIncome - rExpense,
                    },
                    V: {
                        name: 'Partner V',
                        code: 'V',
                        total_income: vIncome,
                        total_expense: vExpense,
                        net_balance: vIncome - vExpense,
                    },
                    D: {
                        name: 'Partner D',
                        code: 'D',
                        total_income: dIncome,
                        total_expense: dExpense,
                        net_balance: dIncome - dExpense,
                    },
                },
            },
        });
    } catch (err) {
        next(err);
    }
}

// Get All Partner Transactions
async function getPartnerTransactions(req, res, next) {
    try {
        const { entry_type, partner, split_type } = req.query;

        let sql = `
            SELECT pt.*, u.full_name as creator_name
            FROM partner_transactions pt
            LEFT JOIN users u ON pt.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (entry_type && entry_type !== 'All') {
            params.push(entry_type);
            sql += ` AND pt.entry_type = $${params.length}`;
        }

        if (split_type && split_type !== 'All') {
            params.push(split_type);
            sql += ` AND pt.split_type = $${params.length}`;
        }

        if (partner && partner !== 'All') {
            if (partner === 'ALL') {
                params.push('ALL');
                sql += ` AND pt.partner_name = $${params.length}`;
            } else if (['R', 'V', 'D'].includes(partner)) {
                params.push(partner);
                sql += ` AND (pt.partner_name = $${params.length} OR pt.split_type = 'Split')`;
            }
        }

        sql += ` ORDER BY pt.transaction_date DESC, pt.id DESC`;

        const result = await query(sql, params);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (err) {
        next(err);
    }
}

// Create Partner Transaction
async function createPartnerTransaction(req, res, next) {
    try {
        const {
            entry_type,
            split_type,
            partner_name,
            total_amount,
            description,
            transaction_date,
            notes,
        } = req.body;

        if (!entry_type || !split_type || !total_amount || !description || !transaction_date) {
            return res.status(400).json({
                success: false,
                message: 'Entry type, split type, amount, description, and date are required.',
            });
        }

        if (!['Income', 'Expense'].includes(entry_type)) {
            return res.status(400).json({
                success: false,
                message: 'Entry type must be either Income or Expense.',
            });
        }

        if (!['Split', 'Individual'].includes(split_type)) {
            return res.status(400).json({
                success: false,
                message: 'Split type must be either Split or Individual.',
            });
        }

        const amount = parseFloat(total_amount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0.',
            });
        }

        let finalPartner = partner_name || 'ALL';
        let amountR = 0;
        let amountV = 0;
        let amountD = 0;

        if (split_type === 'Split') {
            finalPartner = 'ALL';
            // Equal division by 3: e.g. 10000 / 3 = 3333.33 for R, 3333.33 for V, and 3333.34 for D
            amountR = Math.floor((amount / 3) * 100) / 100;
            amountV = Math.floor((amount / 3) * 100) / 100;
            amountD = Math.round((amount - amountR - amountV) * 100) / 100;
        } else {
            // Individual assignment to R, V, or D
            if (!['R', 'V', 'D'].includes(finalPartner)) {
                return res.status(400).json({
                    success: false,
                    message: 'Individual transactions must specify partner R, V, or D.',
                });
            }

            if (finalPartner === 'R') amountR = amount;
            if (finalPartner === 'V') amountV = amount;
            if (finalPartner === 'D') amountD = amount;
        }

        // Auto-generate code
        const countRes = await query('SELECT COUNT(*) as count FROM partner_transactions');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 101;
        const code = `PTR-${nextNum}`;

        const insertRes = await query(
            `INSERT INTO partner_transactions (transaction_code, entry_type, split_type, partner_name, total_amount, amount_r, amount_v, amount_d, description, transaction_date, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                code,
                entry_type,
                split_type,
                finalPartner,
                amount,
                amountR,
                amountV,
                amountD,
                description.trim(),
                transaction_date,
                notes || null,
                req.user.id,
            ]
        );

        await logAudit(
            req.user.id,
            req.user.email,
            'CREATE',
            'partner_transaction',
            insertRes.rows[0].id,
            `Recorded partner ${entry_type.toLowerCase()} of ₹${amount} (${split_type}: ${finalPartner})`,
            req.ip
        );

        res.status(201).json({
            success: true,
            message: `Partner ${entry_type.toLowerCase()} transaction recorded successfully.`,
            data: insertRes.rows[0],
        });
    } catch (err) {
        next(err);
    }
}

// Delete Partner Transaction
async function deletePartnerTransaction(req, res, next) {
    try {
        const { id } = req.params;

        const checkRes = await query('SELECT * FROM partner_transactions WHERE id = $1', [id]);
        if (checkRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Partner transaction not found.' });
        }

        await query('DELETE FROM partner_transactions WHERE id = $1', [id]);

        await logAudit(
            req.user.id,
            req.user.email,
            'DELETE',
            'partner_transaction',
            id,
            `Deleted partner transaction ${checkRes.rows[0].transaction_code}`,
            req.ip
        );

        res.json({
            success: true,
            message: 'Partner transaction deleted successfully.',
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getPartnerSummary,
    getPartnerTransactions,
    createPartnerTransaction,
    deletePartnerTransaction,
};
