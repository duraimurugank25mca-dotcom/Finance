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

// Export Comprehensive Financial Report Excel (.xlsx) containing both Income and Expenses up to a selected date
async function exportReportExcel(req, res, next) {
    try {
        const ExcelJS = require('exceljs');
        const { upto_date, to_date, from_date } = req.query;
        const targetUptoDate = upto_date || to_date || new Date().toISOString().split('T')[0];
        const targetFromDate = from_date || null;

        // 1. Fetch Income records up to date
        let incomeQuery = `
            SELECT i.id, i.income_code, i.payment_date, i.client_name, i.amount, i.payment_method,
                   i.transaction_reference, i.is_advance, i.project_type, i.project_details, i.notes,
                   p.name as project_name, p.project_code, u.full_name as received_by_name
            FROM income_transactions i
            LEFT JOIN projects p ON i.project_id = p.id
            LEFT JOIN users u ON i.received_by = u.id
            WHERE i.payment_date <= $1
        `;
        const incomeParams = [targetUptoDate];
        if (targetFromDate) {
            incomeParams.push(targetFromDate);
            incomeQuery += ` AND i.payment_date >= $2`;
        }
        incomeQuery += ` ORDER BY i.payment_date DESC, i.id DESC`;

        const incomeResult = await query(incomeQuery, incomeParams);
        const incomeRows = incomeResult.rows;

        // 2. Fetch Expense records up to date
        let expenseQuery = `
            SELECT e.id, e.expense_code, e.expense_date, e.category_name, e.description, e.amount,
                   e.payment_method, e.paid_by, e.status, e.notes,
                   p.name as project_name, p.project_code, u.full_name as recorded_by_name
            FROM expenses e
            LEFT JOIN projects p ON e.project_id = p.id
            LEFT JOIN users u ON e.user_id = u.id
            WHERE e.expense_date <= $1
        `;
        const expenseParams = [targetUptoDate];
        if (targetFromDate) {
            expenseParams.push(targetFromDate);
            expenseQuery += ` AND e.expense_date >= $2`;
        }
        expenseQuery += ` ORDER BY e.expense_date DESC, e.id DESC`;

        const expenseResult = await query(expenseQuery, expenseParams);
        const expenseRows = expenseResult.rows;

        // 3. Totals
        const totalIncome = incomeRows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const totalExpenses = expenseRows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const totalAdvances = incomeRows.filter(r => r.is_advance).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
        const netBalance = totalIncome - totalExpenses;

        const formatDate = (d) => {
            if (!d) return 'N/A';
            if (typeof d === 'string') return d.split('T')[0];
            if (d instanceof Date) return d.toISOString().split('T')[0];
            return String(d);
        };

        // 4. Create Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Duolink Finance';
        workbook.lastModifiedBy = req.user ? req.user.full_name : 'Duolink Admin';
        workbook.created = new Date();
        workbook.modified = new Date();

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // --- SHEET 1: EXECUTIVE FINANCIAL SUMMARY ---
        const wsSummary = workbook.addWorksheet('Executive Summary', {
            views: [{ showGridLines: true }]
        });

        wsSummary.columns = [
            { width: 34 },
            { width: 24 },
            { width: 50 }
        ];

        // Title Header
        wsSummary.mergeCells('A1:C1');
        const titleCell = wsSummary.getCell('A1');
        titleCell.value = 'DUOLINK FINANCE - COMPREHENSIVE FINANCIAL REPORT';
        titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsSummary.getRow(1).height = 38;

        // Subtitle / Scope
        wsSummary.mergeCells('A2:C2');
        const subCell = wsSummary.getCell('A2');
        subCell.value = `Report Scope: Data up to ${targetUptoDate}${targetFromDate ? ` (From: ${targetFromDate})` : ' (All Historical Records)'} | Generated: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        subCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
        subCell.alignment = { horizontal: 'center', vertical: 'middle' };
        wsSummary.getRow(2).height = 24;

        // Section: Key Financial Indicators
        wsSummary.getCell('A4').value = 'KEY FINANCIAL INDICATORS';
        wsSummary.getCell('A4').font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };

        const sumHeaderRow = wsSummary.getRow(5);
        sumHeaderRow.values = ['Financial Metric', 'Amount (₹)', 'Description'];
        sumHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sumHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        sumHeaderRow.height = 26;

        const summaryData = [
            ['Total Cash Inflow (Income & Advances)', totalIncome, 'Total payments, client advances, and direct receipts recorded.'],
            ['Total Client Advances Received', totalAdvances, 'Contract kick-off and milestone advances.'],
            ['Total Company & Project Expenses', totalExpenses, 'All operational costs, project expenditures, and reimbursements.'],
            ['Net Available Cash Balance', netBalance, 'Calculated liquidity: (Total Cash Inflow - Total Expenses).']
        ];

        summaryData.forEach((row, idx) => {
            const r = wsSummary.addRow(row);
            r.height = 24;
            r.getCell(1).font = { bold: idx === 3 };
            r.getCell(2).numFmt = '₹#,##0.00';
            r.getCell(2).font = { bold: true, color: { argb: idx === 3 ? (netBalance >= 0 ? 'FF16A34A' : 'FFDC2626') : (idx === 2 ? 'FFDC2626' : 'FF16A34A') } };
            r.getCell(1).border = thinBorder;
            r.getCell(2).border = thinBorder;
            r.getCell(3).border = thinBorder;
            if (idx % 2 === 1) {
                r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });

        // Section: Category Breakdown for Expenses
        const categoryMap = {};
        expenseRows.forEach(e => {
            const cat = e.category_name || 'Uncategorized';
            categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(e.amount || 0);
        });

        const startCatRow = 11;
        wsSummary.getCell(`A${startCatRow}`).value = 'EXPENSES BREAKDOWN BY CATEGORY';
        wsSummary.getCell(`A${startCatRow}`).font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };

        const catHeaderRow = wsSummary.getRow(startCatRow + 1);
        catHeaderRow.values = ['Expense Category', 'Total Amount (₹)', '% of Total Expenses'];
        catHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        catHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        catHeaderRow.height = 24;

        const catEntries = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
        if (catEntries.length === 0) {
            const noExpRow = wsSummary.addRow(['No expenses found up to selected date', 0, '0.0%']);
            noExpRow.getCell(2).numFmt = '₹#,##0.00';
            noExpRow.getCell(1).border = thinBorder;
            noExpRow.getCell(2).border = thinBorder;
            noExpRow.getCell(3).border = thinBorder;
        } else {
            catEntries.forEach(([cat, amt]) => {
                const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                const r = wsSummary.addRow([cat, amt, `${pct.toFixed(1)}%`]);
                r.height = 22;
                r.getCell(2).numFmt = '₹#,##0.00';
                r.getCell(1).border = thinBorder;
                r.getCell(2).border = thinBorder;
                r.getCell(3).border = thinBorder;
            });
        }


        // --- SHEET 2: INCOME & ADVANCES ---
        const wsIncome = workbook.addWorksheet('Income & Advances', {
            views: [{ showGridLines: true }]
        });

        wsIncome.columns = [
            { header: 'Income Code', key: 'code', width: 14 },
            { header: 'Payment Date', key: 'date', width: 14 },
            { header: 'Client Name', key: 'client', width: 26 },
            { header: 'Amount (₹)', key: 'amount', width: 18 },
            { header: 'Type', key: 'type', width: 16 },
            { header: 'Project Name', key: 'project', width: 26 },
            { header: 'Project Type', key: 'project_type', width: 18 },
            { header: 'Payment Method', key: 'method', width: 16 },
            { header: 'Reference / Details', key: 'details', width: 30 },
            { header: 'Received By', key: 'received_by', width: 18 },
            { header: 'Notes', key: 'notes', width: 25 }
        ];

        const incHeaderRow = wsIncome.getRow(1);
        incHeaderRow.height = 30;
        incHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        incHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
        incHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

        incomeRows.forEach((row, i) => {
            const r = wsIncome.addRow({
                code: row.income_code,
                date: formatDate(row.payment_date),
                client: row.client_name,
                amount: parseFloat(row.amount || 0),
                type: row.is_advance ? 'Advance' : 'Direct / Settlement',
                project: row.project_name || 'General Inflow',
                project_type: row.project_type || 'N/A',
                method: row.payment_method,
                details: row.transaction_reference || row.project_details || 'N/A',
                received_by: row.received_by_name || 'System Admin',
                notes: row.notes || ''
            });
            r.height = 22;
            r.getCell('amount').numFmt = '₹#,##0.00';
            r.getCell('amount').font = { bold: true, color: { argb: 'FF16A34A' } };
            r.eachCell(cell => { cell.border = thinBorder; });
            if (i % 2 === 1) {
                r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
            }
        });

        // Add Income Total Row
        const incTotalRow = wsIncome.addRow({
            code: 'TOTAL',
            date: '',
            client: `Count: ${incomeRows.length} records`,
            amount: totalIncome,
            type: '',
            project: '',
            project_type: '',
            method: '',
            details: '',
            received_by: '',
            notes: ''
        });
        incTotalRow.height = 26;
        incTotalRow.font = { bold: true, size: 11 };
        incTotalRow.getCell('amount').numFmt = '₹#,##0.00';
        incTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        incTotalRow.eachCell(cell => { cell.border = thinBorder; });


        // --- SHEET 3: EXPENSES ---
        const wsExpenses = workbook.addWorksheet('Expenses', {
            views: [{ showGridLines: true }]
        });

        wsExpenses.columns = [
            { header: 'Expense Code', key: 'code', width: 14 },
            { header: 'Date', key: 'date', width: 14 },
            { header: 'Category', key: 'category', width: 22 },
            { header: 'Description', key: 'description', width: 34 },
            { header: 'Amount (₹)', key: 'amount', width: 18 },
            { header: 'Payment Method', key: 'method', width: 16 },
            { header: 'Paid By', key: 'paid_by', width: 20 },
            { header: 'Linked Project', key: 'project', width: 26 },
            { header: 'Status', key: 'status', width: 14 },
            { header: 'Recorded By', key: 'recorded_by', width: 18 },
            { header: 'Notes', key: 'notes', width: 25 }
        ];

        const expHeaderRow = wsExpenses.getRow(1);
        expHeaderRow.height = 30;
        expHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        expHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        expHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

        expenseRows.forEach((row, i) => {
            const r = wsExpenses.addRow({
                code: row.expense_code,
                date: formatDate(row.expense_date),
                category: row.category_name,
                description: row.description,
                amount: parseFloat(row.amount || 0),
                method: row.payment_method,
                paid_by: row.paid_by || 'Corporate',
                project: row.project_name || 'Company Overhead',
                status: row.status || 'Approved',
                recorded_by: row.recorded_by_name || 'System Admin',
                notes: row.notes || ''
            });
            r.height = 22;
            r.getCell('amount').numFmt = '₹#,##0.00';
            r.getCell('amount').font = { bold: true, color: { argb: 'FFDC2626' } };
            r.eachCell(cell => { cell.border = thinBorder; });
            if (i % 2 === 1) {
                r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
            }
        });

        // Add Expenses Total Row
        const expTotalRow = wsExpenses.addRow({
            code: 'TOTAL',
            date: '',
            category: `Count: ${expenseRows.length} records`,
            description: '',
            amount: totalExpenses,
            method: '',
            paid_by: '',
            project: '',
            status: '',
            recorded_by: '',
            notes: ''
        });
        expTotalRow.height = 26;
        expTotalRow.font = { bold: true, size: 11 };
        expTotalRow.getCell('amount').numFmt = '₹#,##0.00';
        expTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        expTotalRow.eachCell(cell => { cell.border = thinBorder; });


        // --- SHEET 4: COMBINED FINANCIAL LEDGER (Income & Expenses together!) ---
        const wsLedger = workbook.addWorksheet('Combined Ledger', {
            views: [{ showGridLines: true }]
        });

        wsLedger.columns = [
            { header: 'Date', key: 'date', width: 14 },
            { header: 'Type', key: 'type', width: 14 },
            { header: 'Ref Code', key: 'code', width: 14 },
            { header: 'Client / Payee / Category', key: 'party', width: 26 },
            { header: 'Description / Details', key: 'desc', width: 34 },
            { header: 'Project', key: 'project', width: 24 },
            { header: 'Payment Method', key: 'method', width: 16 },
            { header: 'Inflow (+) (₹)', key: 'inflow', width: 18 },
            { header: 'Outflow (-) (₹)', key: 'outflow', width: 18 }
        ];

        const ledgerHeader = wsLedger.getRow(1);
        ledgerHeader.height = 30;
        ledgerHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        ledgerHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        ledgerHeader.alignment = { vertical: 'middle', horizontal: 'center' };

        const combined = [
            ...incomeRows.map(r => ({
                date: formatDate(r.payment_date),
                type: r.is_advance ? 'Advance' : 'Income',
                code: r.income_code,
                party: r.client_name,
                desc: r.transaction_reference || r.project_details || r.notes || 'Client Payment',
                project: r.project_name || 'General Inflow',
                method: r.payment_method,
                inflow: parseFloat(r.amount || 0),
                outflow: 0
            })),
            ...expenseRows.map(r => ({
                date: formatDate(r.expense_date),
                type: 'Expense',
                code: r.expense_code,
                party: r.category_name,
                desc: r.description,
                project: r.project_name || 'Company Overhead',
                method: r.payment_method,
                inflow: 0,
                outflow: parseFloat(r.amount || 0)
            }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        combined.forEach((item, i) => {
            const r = wsLedger.addRow(item);
            r.height = 22;
            r.getCell('inflow').numFmt = '₹#,##0.00';
            r.getCell('outflow').numFmt = '₹#,##0.00';
            if (item.inflow > 0) {
                r.getCell('inflow').font = { color: { argb: 'FF16A34A' }, bold: true };
                r.getCell('type').font = { color: { argb: 'FF16A34A' }, bold: true };
            } else {
                r.getCell('outflow').font = { color: { argb: 'FFDC2626' }, bold: true };
                r.getCell('type').font = { color: { argb: 'FFDC2626' }, bold: true };
            }
            r.eachCell(cell => { cell.border = thinBorder; });
            if (i % 2 === 1) {
                r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            }
        });

        // Combined Total Row
        const ledgerTotal = wsLedger.addRow({
            date: 'TOTAL',
            type: `${combined.length} txns`,
            code: '',
            party: '',
            desc: `Net Balance: ₹${netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            project: '',
            method: '',
            inflow: totalIncome,
            outflow: totalExpenses
        });
        ledgerTotal.height = 28;
        ledgerTotal.font = { bold: true, size: 11 };
        ledgerTotal.getCell('inflow').numFmt = '₹#,##0.00';
        ledgerTotal.getCell('outflow').numFmt = '₹#,##0.00';
        ledgerTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        ledgerTotal.eachCell(cell => { cell.border = thinBorder; });

        // Stream workbook to response
        const filename = `Duolink_Financial_Report_Upto_${targetUptoDate}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getDashboardSummary,
    getFinancialReports,
    exportReportCsv,
    exportReportExcel,
};
