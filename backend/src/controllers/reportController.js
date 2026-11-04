const { query } = require('../config/db');

// Main Dashboard Summary Metrics
async function getDashboardSummary(req, res, next) {
    try {
        const isUser = req.user.role !== 'Admin';
        const userId = req.user.id;

        // 1. Total Company Income & Advances
        let incomeSql = `
            SELECT 
                COALESCE(SUM(amount), 0) as total_income,
                COALESCE(SUM(CASE WHEN is_advance = TRUE THEN amount ELSE 0 END), 0) as total_advances,
                COALESCE(SUM(CASE WHEN project_id IS NOT NULL THEN amount ELSE 0 END), 0) as total_project_income
            FROM income_transactions
        `;
        const incomeParams = [];
        if (isUser) {
            incomeSql += ` WHERE received_by = $1 OR project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
            incomeParams.push(userId);
        }
        const incomeRes = await query(incomeSql, incomeParams);
        const totalIncome = parseFloat(incomeRes.rows[0].total_income || 0);
        const totalAdvances = parseFloat(incomeRes.rows[0].total_advances || 0);
        const totalProjectIncome = parseFloat(incomeRes.rows[0].total_project_income || 0);

        // 2. Total Company Expenses & Project Expenses
        let expenseSql = `
            SELECT 
                COALESCE(SUM(amount), 0) as total_expenses,
                COALESCE(SUM(CASE WHEN project_id IS NOT NULL THEN amount ELSE 0 END), 0) as total_project_expenses
            FROM expenses
        `;
        const expenseParams = [];
        if (isUser) {
            expenseSql += ` WHERE user_id = $1 OR project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
            expenseParams.push(userId);
        }
        const expenseRes = await query(expenseSql, expenseParams);
        const totalExpenses = parseFloat(expenseRes.rows[0].total_expenses || 0);
        const totalProjectExpenses = parseFloat(expenseRes.rows[0].total_project_expenses || 0);

        // Company Available Balance = Total Income - Total Expenses
        const availableBalance = totalIncome - totalExpenses;

        // 3. Pending Client Payments (Sum of unpaid balance on active invoices + projects)
        let invoicePendingSql = `
            SELECT 
                COALESCE(SUM(i.total_amount - i.advance_deduction), 0) as total_invoiced_net,
                (SELECT COALESCE(SUM(p.amount), 0) FROM payments p 
                 JOIN invoices inv ON p.invoice_id = inv.id 
                 ${isUser ? 'WHERE inv.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)' : ''}
                ) as total_invoice_payments
            FROM invoices i
        `;
        const invParams = isUser ? [userId] : [];
        if (isUser) {
            invoicePendingSql += ` WHERE i.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
        }
        const invRes = await query(invoicePendingSql, invParams);
        const totalInvoicedNet = parseFloat(invRes.rows[0].total_invoiced_net || 0);
        const totalInvoicePayments = parseFloat(invRes.rows[0].total_invoice_payments || 0);
        const pendingClientPayments = Math.max(0, totalInvoicedNet - totalInvoicePayments);

        // 4. Project Profit
        const totalProjectProfit = totalProjectIncome - totalProjectExpenses;

        // 5. Recent Transactions Feed
        let recentIncomeSql = `
            SELECT inc.id, inc.income_code as code, inc.client_name, inc.amount, inc.payment_date, inc.payment_method, inc.is_advance,
                   p.name as project_name, 'income' as type
            FROM income_transactions inc
            LEFT JOIN projects p ON inc.project_id = p.id
        `;
        if (isUser) {
            recentIncomeSql += ` WHERE inc.received_by = $1 OR inc.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
        }
        recentIncomeSql += ` ORDER BY inc.payment_date DESC, inc.id DESC LIMIT 5`;

        let recentExpenseSql = `
            SELECT exp.id, exp.expense_code as code, exp.category_name, exp.description, exp.amount, exp.expense_date, exp.payment_method,
                   p.name as project_name, 'expense' as type
            FROM expenses exp
            LEFT JOIN projects p ON exp.project_id = p.id
        `;
        if (isUser) {
            recentExpenseSql += ` WHERE exp.user_id = $1 OR exp.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
        }
        recentExpenseSql += ` ORDER BY exp.expense_date DESC, exp.id DESC LIMIT 5`;

        const recentIncome = await query(recentIncomeSql, isUser ? [userId] : []);
        const recentExpenses = await query(recentExpenseSql, isUser ? [userId] : []);

        res.json({
            success: true,
            data: {
                total_income: totalIncome,
                total_expenses: totalExpenses,
                available_balance: availableBalance,
                total_project_income: totalProjectIncome,
                total_project_expenses: totalProjectExpenses,
                advances_received: totalAdvances,
                pending_client_payments: pendingClientPayments,
                project_profit: totalProjectProfit,
                recent_activity: {
                    income: recentIncome.rows,
                    expenses: recentExpenses.rows,
                },
            },
        });
    } catch (err) {
        next(err);
    }
}

// Monthly & Yearly Analytics
async function getFinancialReports(req, res, next) {
    try {
        const { year = new Date().getFullYear() } = req.query;

        // Monthly Income Breakdown
        const monthlyIncomeRes = await query(
            `SELECT EXTRACT(MONTH FROM payment_date) as month,
                    SUM(amount) as total
             FROM income_transactions
             WHERE EXTRACT(YEAR FROM payment_date) = $1
             GROUP BY EXTRACT(MONTH FROM payment_date)
             ORDER BY month ASC`,
            [year]
        );

        // Monthly Expense Breakdown
        const monthlyExpenseRes = await query(
            `SELECT EXTRACT(MONTH FROM expense_date) as month,
                    SUM(amount) as total
             FROM expenses
             WHERE EXTRACT(YEAR FROM expense_date) = $1
             GROUP BY EXTRACT(MONTH FROM expense_date)
             ORDER BY month ASC`,
            [year]
        );

        const monthlyData = [];
        for (let m = 1; m <= 12; m++) {
            const inc = monthlyIncomeRes.rows.find((r) => parseInt(r.month, 10) === m);
            const exp = monthlyExpenseRes.rows.find((r) => parseInt(r.month, 10) === m);
            const incVal = inc ? parseFloat(inc.total) : 0;
            const expVal = exp ? parseFloat(exp.total) : 0;

            monthlyData.push({
                month: m,
                monthName: new Date(year, m - 1, 1).toLocaleString('default', { month: 'short' }),
                income: incVal,
                expense: expVal,
                net: incVal - expVal,
            });
        }

        // Project-wise Profit & Loss
        const projectPLRes = await query(`
            SELECT p.id, p.project_code, p.name, p.client_name, p.contract_amount, p.status,
                COALESCE((SELECT SUM(amount) FROM income_transactions WHERE project_id = p.id), 0) as total_income,
                COALESCE((SELECT SUM(amount) FROM expenses WHERE project_id = p.id), 0) as total_expenses
            FROM projects p
            ORDER BY p.id ASC
        `);

        const projectPL = projectPLRes.rows.map((p) => {
            const inc = parseFloat(p.total_income);
            const exp = parseFloat(p.total_expenses);
            const contract = parseFloat(p.contract_amount);
            return {
                ...p,
                total_income: inc,
                total_expenses: exp,
                profit_loss: inc - exp,
                profit_margin: inc > 0 ? (((inc - exp) / inc) * 100).toFixed(1) : 0,
                pending_payment: Math.max(0, contract - inc),
            };
        });

        // Category-wise Breakdown
        const categoryRes = await query(`
            SELECT category_name, SUM(amount) as total, COUNT(*) as count
            FROM expenses
            GROUP BY category_name
            ORDER BY total DESC
        `);

        res.json({
            success: true,
            year: parseInt(year, 10),
            monthly_breakdown: monthlyData,
            project_profit_loss: projectPL,
            category_analysis: categoryRes.rows.map((c) => ({
                category_name: c.category_name,
                total: parseFloat(c.total),
                count: parseInt(c.count, 10),
            })),
        });
    } catch (err) {
        next(err);
    }
}

// Export Financial Report CSV
async function exportReportCsv(req, res, next) {
    try {
        const { type = 'expenses' } = req.query;

        if (type === 'expenses') {
            const expRes = await query(`
                SELECT e.expense_code, e.expense_date, e.category_name, e.description, e.amount, e.payment_method, e.paid_by, p.name as project_name
                FROM expenses e
                LEFT JOIN projects p ON e.project_id = p.id
                ORDER BY e.expense_date DESC
            `);

            let csv = 'Code,Date,Category,Description,Amount,Payment Method,Paid By,Project\n';
            expRes.rows.forEach((r) => {
                csv += `"${r.expense_code}","${r.expense_date}","${r.category_name}","${r.description.replace(/"/g, '""')}","${r.amount}","${r.payment_method}","${r.paid_by}","${r.project_name || 'N/A'}"\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="Duolink_Expenses_Report.csv"');
            return res.send(csv);
        } else if (type === 'income') {
            const incRes = await query(`
                SELECT i.income_code, i.payment_date, i.client_name, i.amount, i.payment_method, i.is_advance, i.project_type, i.project_details, p.name as project_name, i.notes
                FROM income_transactions i
                LEFT JOIN projects p ON i.project_id = p.id
                ORDER BY i.payment_date DESC
            `);

            let csv = 'Code,Date,Client,Amount,Payment Method,Project Type,Project Details,Project\n';
            incRes.rows.forEach((r) => {
                csv += `"${r.income_code}","${r.payment_date}","${r.client_name}","${r.amount}","${r.payment_method}","${r.project_type || 'N/A'}","${(r.project_details || '').replace(/"/g, '""')}","${r.project_name || 'N/A'}"\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="Duolink_Income_Report.csv"');
            return res.send(csv);
        }

        res.status(400).json({ success: false, message: 'Invalid export type. Use "expenses" or "income".' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getDashboardSummary,
    getFinancialReports,
    exportReportCsv,
};
