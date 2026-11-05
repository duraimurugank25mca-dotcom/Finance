const fs = require('fs');
const path = require('path');
const { query, transaction } = require('../config/db');
const { generateInvoicePdf } = require('../services/pdfService');
const { logAudit } = require('../services/auditService');

// Get Invoices List
async function getInvoices(req, res, next) {
    try {
        const { projectId, status } = req.query;

        let sql = `
            SELECT i.*,
                   p.name as project_name,
                   p.project_code,
                   (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = i.id) as payments_received
            FROM invoices i
            JOIN projects p ON i.project_id = p.id
            WHERE 1=1
        `;
        const params = [];

        // Role restriction: Admin sees all; User sees assigned projects only
        if (req.user.role !== 'Admin') {
            sql += ` AND i.project_id IN (SELECT project_id FROM project_members WHERE user_id = $${params.length + 1})`;
            params.push(req.user.id);
        }

        if (projectId && projectId !== 'All') {
            params.push(projectId);
            sql += ` AND i.project_id = $${params.length}`;
        }
        if (status && status !== 'All') {
            params.push(status);
            sql += ` AND i.status = $${params.length}`;
        }

        sql += ` ORDER BY i.invoice_date DESC, i.id DESC`;

        const result = await query(sql, params);

        // Compute balances
        const invoices = result.rows.map((inv) => {
            const total = parseFloat(inv.total_amount || 0);
            const advance = parseFloat(inv.advance_deduction || 0);
            const paid = parseFloat(inv.payments_received || 0);
            const remaining = Math.max(0, total - advance - paid);

            return {
                ...inv,
                total_amount: total,
                advance_deduction: advance,
                payments_received: paid,
                remaining_balance: remaining,
            };
        });

        res.json({ success: true, count: invoices.length, data: invoices });
    } catch (err) {
        next(err);
    }
}

// Get Single Invoice with Items & Payments
async function getInvoiceById(req, res, next) {
    try {
        const { id } = req.params;

        const invRes = await query(
            `SELECT i.*, p.name as project_name, p.project_code, p.contract_amount,
                    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = i.id) as payments_received
             FROM invoices i
             JOIN projects p ON i.project_id = p.id
             WHERE i.id = $1`,
            [id]
        );

        if (invRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }

        const invoice = invRes.rows[0];

        // Access check for User
        if (req.user.role !== 'Admin') {
            const memberCheck = await query(
                'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
                [invoice.project_id, req.user.id]
            );
            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Access denied to this project invoice.' });
            }
        }

        // Fetch line items
        const itemsRes = await query(
            'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC',
            [id]
        );

        // Fetch payment history
        const paymentsRes = await query(
            `SELECT pay.*, u.full_name as recorder_name
             FROM payments pay
             LEFT JOIN users u ON pay.recorded_by = u.id
             WHERE pay.invoice_id = $1
             ORDER BY pay.payment_date DESC`,
            [id]
        );

        const total = parseFloat(invoice.total_amount || 0);
        const advance = parseFloat(invoice.advance_deduction || 0);
        const paid = parseFloat(invoice.payments_received || 0);
        const remaining = Math.max(0, total - advance - paid);

        res.json({
            success: true,
            data: {
                ...invoice,
                total_amount: total,
                advance_deduction: advance,
                payments_received: paid,
                remaining_balance: remaining,
                items: itemsRes.rows,
                payments: paymentsRes.rows,
            },
        });
    } catch (err) {
        next(err);
    }
}

// Generate Invoice (Admin or User with project access)
async function createInvoice(req, res, next) {
    try {
        const {
            project_id,
            invoice_date,
            due_date,
            advance_deduction,
            items,
            payment_terms,
            notes,
        } = req.body;

        if (!project_id || !invoice_date || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Project, invoice date, and at least one line item are required.',
            });
        }

        // Access check
        if (req.user.role !== 'Admin') {
            const memberCheck = await query(
                'SELECT can_view_bills FROM project_members WHERE project_id = $1 AND user_id = $2',
                [project_id, req.user.id]
            );
            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Access denied. You are not assigned to this project.' });
            }
        }

        const projectRes = await query('SELECT * FROM projects WHERE id = $1', [project_id]);
        if (projectRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }
        const project = projectRes.rows[0];

        // Calculate total from line items
        let totalAmount = 0;
        const processedItems = items.map((it) => {
            const qty = parseFloat(it.quantity || 1);
            const rate = parseFloat(it.unit_price || 0);
            const itemTotal = qty * rate;
            totalAmount += itemTotal;
            return {
                description: it.description,
                quantity: qty,
                unit_price: rate,
                amount: itemTotal,
            };
        });

        // Generate Invoice Number (e.g. DL-INV-2026-0003)
        const countRes = await query('SELECT COUNT(*) as count FROM invoices');
        const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
        const invoiceNumber = `DL-INV-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

        const advanceDed = parseFloat(advance_deduction || 0);

        const newInvoice = await transaction(async (client) => {
            const invRes = await client.query(
                `INSERT INTO invoices (invoice_number, invoice_date, due_date, project_id, client_name, client_contact, total_amount, advance_deduction, tax_amount, notes, payment_terms, status, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.00, $9, $10, 'Issued', $11) RETURNING *`,
                [
                    invoiceNumber,
                    invoice_date,
                    due_date || null,
                    project_id,
                    project.client_name,
                    `${project.client_email || ''} | ${project.client_phone || ''}`,
                    totalAmount,
                    advanceDed,
                    notes || null,
                    payment_terms || 'Payment is due within 15 days of invoice date. Duolink Finance Corp.',
                    req.user.id,
                ]
            );

            const createdInv = invRes.rows[0];

            for (const item of processedItems) {
                await client.query(
                    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [createdInv.id, item.description, item.quantity, item.unit_price, item.amount]
                );
            }

            return createdInv;
        });

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'CREATE_INVOICE',
            entityType: 'invoice',
            entityId: newInvoice.id,
            details: `Created invoice ${newInvoice.invoice_number} for $${newInvoice.total_amount}`,
            req,
        });

        res.status(201).json({ success: true, message: 'Invoice generated successfully.', data: newInvoice });
    } catch (err) {
        next(err);
    }
}

// Download / Stream Invoice PDF
async function downloadInvoicePdf(req, res, next) {
    try {
        const { id } = req.params;

        const invRes = await query(
            `SELECT i.*, p.name as project_name, p.project_code, p.contract_amount,
                    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = i.id) as payments_received
             FROM invoices i
             JOIN projects p ON i.project_id = p.id
             WHERE i.id = $1`,
            [id]
        );

        if (invRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }

        const invoice = invRes.rows[0];

        // Access check (Admins and authorized project members have access; public links allowed)
        if (req.user && req.user.role !== 'Admin') {
            const memberCheck = await query(
                'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
                [invoice.project_id, req.user.id]
            );
            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        }

        // Fetch line items
        const itemsRes = await query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id]);
        invoice.items = itemsRes.rows;
        invoice.previous_payments = invoice.payments_received;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Duolink_Invoice_${invoice.invoice_number}.pdf"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        await generateInvoicePdf(invoice, res);
    } catch (err) {
        next(err);
    }
}

// Record Payment Against Invoice
async function recordInvoicePayment(req, res, next) {
    try {
        const { id } = req.params;
        const { amount, payment_date, payment_method, transaction_reference, notes } = req.body;

        if (!amount || !payment_date || !payment_method) {
            return res.status(400).json({ success: false, message: 'Amount, payment date, and payment method are required.' });
        }

        const invRes = await query('SELECT * FROM invoices WHERE id = $1', [id]);
        if (invRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }
        const invoice = invRes.rows[0];

        const parsedAmount = parseFloat(amount);
        const countRes = await query('SELECT COUNT(*) as count FROM payments');
        const payCode = `PAY-${parseInt(countRes.rows[0].count, 10) + 101}`;

        const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;

        await transaction(async (client) => {
            // 1. Record in payments
            await client.query(
                `INSERT INTO payments (payment_code, invoice_id, amount, payment_date, payment_method, transaction_reference, payment_proof, notes, recorded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    payCode,
                    id,
                    parsedAmount,
                    payment_date,
                    payment_method,
                    transaction_reference || null,
                    proofUrl,
                    notes || null,
                    req.user.id,
                ]
            );

            // 2. Also record in income_transactions (so company income & available balance stay synchronized)
            const incCount = await client.query('SELECT COUNT(*) as count FROM income_transactions');
            const incCode = `INC-${parseInt(incCount.rows[0].count, 10) + 101}`;

            await client.query(
                `INSERT INTO income_transactions (income_code, project_id, invoice_id, client_name, amount, payment_date, payment_method, transaction_reference, is_advance, is_project_income, proof_attachment, notes, received_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, TRUE, $9, $10, $11)`,
                [
                    incCode,
                    invoice.project_id,
                    id,
                    invoice.client_name,
                    parsedAmount,
                    payment_date,
                    payment_method,
                    transaction_reference || null,
                    proofUrl,
                    `Payment for Invoice ${invoice.invoice_number}`,
                    req.user.id,
                ]
            );

            // 3. Update invoice status
            const paidRes = await client.query(
                'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = $1',
                [id]
            );
            const totalPaid = parseFloat(paidRes.rows[0].total_paid);
            const netAmount = parseFloat(invoice.total_amount) - parseFloat(invoice.advance_deduction);

            let newStatus = 'Partially Paid';
            if (totalPaid >= netAmount) {
                newStatus = 'Paid';
            }

            await client.query('UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newStatus, id]);
        });

        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email,
            action: 'RECORD_PAYMENT',
            entityType: 'invoice',
            entityId: id,
            details: `Recorded payment of $${parsedAmount} for invoice ${invoice.invoice_number}`,
            req,
        });

        res.json({ success: true, message: 'Payment recorded and invoice balance updated successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getInvoices,
    getInvoiceById,
    createInvoice,
    downloadInvoicePdf,
    recordInvoicePayment,
};
