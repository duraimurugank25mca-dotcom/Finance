const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

async function runMigrationsAndSeed() {
    console.log('Running database migrations and seed verification...');

    // 1. Read & run SQL schema
    const sqlPath = path.resolve(__dirname, '001_initial_schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL statements safely (ignoring comments)
    const statements = sqlContent
        .replace(/--.*$/gm, '')
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    for (const stmt of statements) {
        try {
            await query(stmt);
        } catch (err) {
            console.error('Error executing schema statement:', err.message, '\nStatement:', stmt.substring(0, 100));
            throw err;
        }
    }
    console.log('Database tables, constraints, and indexes ensured.');

    // Ensure project_type and project_details exist on income_transactions for backward compatibility
    try {
        await query('ALTER TABLE income_transactions ADD COLUMN IF NOT EXISTS project_type VARCHAR(100)');
        await query('ALTER TABLE income_transactions ADD COLUMN IF NOT EXISTS project_details TEXT');
    } catch (e) {
        // Ignored if already exists
    }

    // Ensure partner_transactions table exists
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS partner_transactions (
                id SERIAL PRIMARY KEY,
                transaction_code VARCHAR(50) UNIQUE NOT NULL,
                entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('Income', 'Expense')),
                split_type VARCHAR(20) NOT NULL CHECK (split_type IN ('Split', 'Individual')),
                partner_name VARCHAR(10) NOT NULL CHECK (partner_name IN ('R', 'V', 'D', 'ALL')),
                total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0),
                amount_r NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                amount_v NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                amount_d NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
                description TEXT NOT NULL,
                transaction_date DATE NOT NULL,
                notes TEXT,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query('CREATE INDEX IF NOT EXISTS idx_partner_trans_date ON partner_transactions(transaction_date)');
        await query('CREATE INDEX IF NOT EXISTS idx_partner_trans_type ON partner_transactions(entry_type)');
        await query('CREATE INDEX IF NOT EXISTS idx_partner_trans_partner ON partner_transactions(partner_name)');
    } catch (e) {
        console.error('partner_transactions ensure error:', e.message);
    }

    // 2. Default Expense Categories
    const defaultCategories = [
        { name: 'Salary', description: 'Employee salaries, contractor wages, and bonuses' },
        { name: 'Travel', description: 'Flights, hotels, client visits, and business travel' },
        { name: 'Fuel', description: 'Fuel and petrol for company operations and local transport' },
        { name: 'Office Expenses', description: 'Rent, electricity, internet, supplies, and maintenance' },
        { name: 'Software and Subscriptions', description: 'SaaS tools, cloud hosting (AWS/GCP), licenses, domains' },
        { name: 'Hardware', description: 'Laptops, monitors, networking gear, and lab equipment' },
        { name: 'Marketing', description: 'Digital ads, sponsorships, PR, and branding campaigns' },
        { name: 'Maintenance', description: 'Equipment servicing, repairs, and facility upkeep' },
        { name: 'Other Expenses', description: 'Miscellaneous operational expenses' },
    ];

    for (const cat of defaultCategories) {
        const existing = await query('SELECT id FROM expense_categories WHERE name = $1', [cat.name]);
        if (existing.rows.length === 0) {
            await query(
                'INSERT INTO expense_categories (name, description, is_default) VALUES ($1, $2, TRUE)',
                [cat.name, cat.description]
            );
        }
    }
    console.log('Expense categories verified.');

    // 3. Seed Users (Admin and User)
    const adminCheck = await query('SELECT id FROM users WHERE email = $1', ['admin@duolink.com']);
    let adminId;
    if (adminCheck.rows.length === 0) {
        const adminHash = await bcrypt.hash('Admin@123', 10);
        const res = await query(
            `INSERT INTO users (email, password_hash, full_name, role, can_create_project, can_edit_records, can_delete_records, status)
             VALUES ($1, $2, $3, 'Admin', TRUE, TRUE, TRUE, 'active') RETURNING id`,
            ['admin@duolink.com', adminHash, 'Duolink Admin']
        );
        adminId = res.rows[0].id;
        console.log('Created Admin account: admin@duolink.com / Admin@123');
    } else {
        adminId = adminCheck.rows[0].id;
    }

    const userCheck = await query('SELECT id FROM users WHERE email = $1', ['user@duolink.com']);
    let userId;
    if (userCheck.rows.length === 0) {
        const userHash = await bcrypt.hash('User@123', 10);
        const res = await query(
            `INSERT INTO users (email, password_hash, full_name, role, can_create_project, can_edit_records, can_delete_records, status)
             VALUES ($1, $2, $3, 'User', FALSE, TRUE, FALSE, 'active') RETURNING id`,
            ['user@duolink.com', userHash, 'Alex Rivera']
        );
        userId = res.rows[0].id;
        console.log('Created User account: user@duolink.com / User@123');
    } else {
        userId = userCheck.rows[0].id;
    }

    const user2Check = await query('SELECT id FROM users WHERE email = $1', ['sarah.finance@duolink.com']);
    let user2Id;
    if (user2Check.rows.length === 0) {
        const user2Hash = await bcrypt.hash('Sarah@123', 10);
        const res = await query(
            `INSERT INTO users (email, password_hash, full_name, role, can_create_project, can_edit_records, can_delete_records, status)
             VALUES ($1, $2, $3, 'User', FALSE, FALSE, FALSE, 'active') RETURNING id`,
            ['sarah.finance@duolink.com', user2Hash, 'Sarah Jenkins']
        );
        user2Id = res.rows[0].id;
        console.log('Created User account: sarah.finance@duolink.com / Sarah@123');
    } else {
        user2Id = user2Check.rows[0].id;
    }

    // 4. Seed Projects if explicitly requested
    const projectCount = await query('SELECT COUNT(*) as count FROM projects');
    let p1Id = 1, p2Id = 2, p3Id = 3;
    if (process.env.SEED_DEMO_DATA === 'true' && parseInt(projectCount.rows[0].count, 10) === 0) {
        console.log('Seeding initial projects and financial accounts...');

        // Project 1: Cloud Migration
        const p1 = await query(
            `INSERT INTO projects (project_code, name, client_name, client_email, client_phone, client_address, description, start_date, status, contract_amount, advance_received, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [
                'PRJ-101',
                'Enterprise ERP Cloud Migration',
                'Apex Global Technologies',
                'billing@apextech.com',
                '+1-555-0192',
                '100 Tech Blvd, Suite 400, San Francisco, CA',
                'End-to-end migration of legacy ERP workflows to scalable AWS cloud infrastructure.',
                '2026-08-01',
                'In Progress',
                45000.00,
                15000.00,
                'Milestone 1 completed. Awaiting client signoff on staging environment.',
                adminId,
            ]
        );
        const p1Id = p1.rows[0].id;

        // Assign user to Project 1
        await query(
            `INSERT INTO project_members (project_id, user_id, can_add_income, can_add_expense, can_view_bills)
             VALUES ($1, $2, TRUE, TRUE, TRUE)`,
            [p1Id, userId]
        );

        // Project 2: FinTech Mobile App
        const p2 = await query(
            `INSERT INTO projects (project_code, name, client_name, client_email, client_phone, client_address, description, start_date, status, contract_amount, advance_received, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [
                'PRJ-102',
                'FinTech Mobile Banking Portal',
                'Vertex Capital Partners',
                'accounts@vertexcap.com',
                '+1-555-0843',
                '250 Financial Way, New York, NY',
                'Mobile banking and investment tracking application with biometrics and instant settlements.',
                '2026-09-15',
                'In Progress',
                68000.00,
                20000.00,
                'UI design finalized. Backend microservices in active sprint.',
                adminId,
            ]
        );
        const p2Id = p2.rows[0].id;

        // Assign user to Project 2
        await query(
            `INSERT INTO project_members (project_id, user_id, can_add_income, can_add_expense, can_view_bills)
             VALUES ($1, $2, TRUE, TRUE, TRUE)`,
            [p2Id, userId]
        );

        // Project 3: Supply Chain Platform
        const p3 = await query(
            `INSERT INTO projects (project_code, name, client_name, client_email, client_phone, client_address, description, start_date, status, contract_amount, advance_received, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [
                'PRJ-103',
                'Supply Chain Analytics Engine',
                'Logix Worldwide',
                'ops@logixww.com',
                '+1-555-4421',
                '800 Logistics Pkwy, Chicago, IL',
                'Real-time IoT telemetry analytics and automated freight dispatch dashboard.',
                '2026-06-10',
                'Completed',
                32000.00,
                10000.00,
                'Project completed on schedule with high client satisfaction.',
                adminId,
            ]
        );
        const p3Id = p3.rows[0].id;

        // 5. Seed Invoices
        // Invoice 1 for PRJ-101
        const inv1 = await query(
            `INSERT INTO invoices (invoice_number, invoice_date, due_date, project_id, client_name, client_contact, total_amount, advance_deduction, tax_amount, notes, payment_terms, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [
                'DL-INV-2026-0001',
                '2026-09-01',
                '2026-09-20',
                p1Id,
                'Apex Global Technologies',
                'billing@apextech.com | +1-555-0192',
                22000.00,
                5000.00,
                0.00,
                'Phase 1 Architecture & Infrastructure Provisioning Invoice',
                'Net 20 days. Bank wire or corporate card accepted.',
                'Partially Paid',
                adminId,
            ]
        );
        const inv1Id = inv1.rows[0].id;

        await query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES
             ($1, 'Cloud Infrastructure Architecture & Terraform scripts', 1, 12000.00, 12000.00),
             ($1, 'Database Migration & Data Validation Pipelines', 1, 10000.00, 10000.00)`,
            [inv1Id]
        );

        // Invoice 2 for PRJ-102
        const inv2 = await query(
            `INSERT INTO invoices (invoice_number, invoice_date, due_date, project_id, client_name, client_contact, total_amount, advance_deduction, tax_amount, notes, payment_terms, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [
                'DL-INV-2026-0002',
                '2026-10-01',
                '2026-10-25',
                p2Id,
                'Vertex Capital Partners',
                'accounts@vertexcap.com | +1-555-0843',
                28000.00,
                8000.00,
                0.00,
                'Milestone 1: Design System & Core Authentication Engine',
                'Net 15 days upon milestone verification.',
                'Paid',
                adminId,
            ]
        );
        const inv2Id = inv2.rows[0].id;

        await query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES
             ($1, 'FinTech Mobile UX Wireframes & High Fidelity Prototypes', 1, 10000.00, 10000.00),
             ($1, 'OAuth2 & Biometric Security Authentication Microservice', 1, 18000.00, 18000.00)`,
            [inv2Id]
        );

        // 6. Seed Income & Payments
        // P1 Advance
        await query(
            `INSERT INTO income_transactions (income_code, project_id, client_name, amount, payment_date, payment_method, transaction_reference, is_advance, is_project_income, notes, received_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8, $9)`,
            ['INC-001', p1Id, 'Apex Global Technologies', 15000.00, '2026-08-02', 'Bank Transfer', 'WIRE-APEX-8901', 'Initial project kick-off advance payment', adminId]
        );

        // P2 Advance
        await query(
            `INSERT INTO income_transactions (income_code, project_id, client_name, amount, payment_date, payment_method, transaction_reference, is_advance, is_project_income, notes, received_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8, $9)`,
            ['INC-002', p2Id, 'Vertex Capital Partners', 20000.00, '2026-09-16', 'Bank Transfer', 'ACH-VTX-3312', 'Project commencement advance', adminId]
        );

        // Payment against Inv 1 (Partial payment: $10,000 paid towards remaining $17,000 net)
        await query(
            `INSERT INTO payments (payment_code, invoice_id, amount, payment_date, payment_method, transaction_reference, notes, recorded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            ['PAY-001', inv1Id, 10000.00, '2026-09-15', 'Bank Transfer', 'WIRE-APEX-9421', 'Part payment towards Invoice #1', adminId]
        );
        await query(
            `INSERT INTO income_transactions (income_code, project_id, invoice_id, client_name, amount, payment_date, payment_method, transaction_reference, is_advance, is_project_income, notes, received_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, TRUE, $9, $10)`,
            ['INC-003', p1Id, inv1Id, 'Apex Global Technologies', 10000.00, '2026-09-15', 'Bank Transfer', 'WIRE-APEX-9421', 'Settlement payment for Invoice DL-INV-2026-0001', adminId]
        );

        // Payment against Inv 2 (Full payment: $20,000 after $8,000 advance deduction)
        await query(
            `INSERT INTO payments (payment_code, invoice_id, amount, payment_date, payment_method, transaction_reference, notes, recorded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            ['PAY-002', inv2Id, 20000.00, '2026-10-18', 'Bank Transfer', 'ACH-VTX-5100', 'Full balance payment for Invoice #2', adminId]
        );
        await query(
            `INSERT INTO income_transactions (income_code, project_id, invoice_id, client_name, amount, payment_date, payment_method, transaction_reference, is_advance, is_project_income, notes, received_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, TRUE, $9, $10)`,
            ['INC-004', p2Id, inv2Id, 'Vertex Capital Partners', 20000.00, '2026-10-18', 'Bank Transfer', 'ACH-VTX-5100', 'Settlement payment for Invoice DL-INV-2026-0002', adminId]
        );

        // General Company Income (Consulting advisory)
        await query(
            `INSERT INTO income_transactions (income_code, project_id, client_name, amount, payment_date, payment_method, transaction_reference, is_advance, is_project_income, notes, received_by)
             VALUES ($1, NULL, $2, $3, $4, $5, $6, FALSE, FALSE, $7, $8)`,
            ['INC-005', 'Horizon Cloud Advisory', 7500.00, '2026-10-10', 'UPI / Online', 'TXN-HZ-99120', 'Retainer architectural advisory fee', adminId]
        );

    }

    // 7. Seed Expenses if explicitly requested
    const expenseCount = await query('SELECT COUNT(*) as count FROM expenses');
    if (process.env.SEED_DEMO_DATA === 'true' && parseInt(expenseCount.rows[0].count, 10) === 0) {
        console.log('Seeding initial company & project expenses...');
        const expensesSeed = [
            {
                code: 'EXP-101',
                cat: 'Salary',
                desc: 'September Core Engineering & Developer Salaries',
                amount: 14500.00,
                date: '2026-09-30',
                method: 'Bank Transfer',
                proj: null,
                paid_by: 'Duolink Payroll Account',
                user: adminId,
            },
            {
                code: 'EXP-102',
                cat: 'Software and Subscriptions',
                desc: 'AWS Cloud Hosting & Dedicated VPC Staging Cluster',
                amount: 1850.00,
                date: '2026-10-05',
                method: 'Credit Card',
                proj: 1,
                paid_by: 'Corporate Visa *4421',
                user: userId,
            },
            {
                code: 'EXP-103',
                cat: 'Office Expenses',
                desc: 'Headquarters Office Lease & Fiber Gigabit Internet',
                amount: 3200.00,
                date: '2026-10-01',
                method: 'Bank Transfer',
                proj: null,
                paid_by: 'Duolink Operating Acct',
                user: adminId,
            },
            {
                code: 'EXP-104',
                cat: 'Travel',
                desc: 'Flight & Hotel for On-site Security Workshop at Vertex NY HQ',
                amount: 1250.00,
                date: '2026-09-22',
                method: 'Credit Card',
                proj: 2,
                paid_by: 'Alex Rivera (Reimbursed)',
                user: userId,
            },
            {
                code: 'EXP-105',
                cat: 'Fuel',
                desc: 'Company Transport Fuel & Site Inspection Logistics',
                amount: 380.00,
                date: '2026-10-12',
                method: 'UPI / Online',
                proj: null,
                paid_by: 'Duolink Petty Cash',
                user: userId,
            },
            {
                code: 'EXP-106',
                cat: 'Hardware',
                desc: 'Apple M3 Pro Developer Workstation for Mobile Team',
                amount: 2499.00,
                date: '2026-09-10',
                method: 'Credit Card',
                proj: null,
                paid_by: 'Corporate Visa *4421',
                user: adminId,
            },
        ];

        for (const exp of expensesSeed) {
            await query(
                `INSERT INTO expenses (expense_code, category_name, description, amount, expense_date, payment_method, project_id, paid_by, user_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Approved')`,
                [exp.code, exp.cat, exp.desc, exp.amount, exp.date, exp.method, exp.proj, exp.paid_by, exp.user]
            );
        }

        // Audit Log initialization
        await query(
            `INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_address)
             VALUES ($1, $2, 'SYSTEM_INIT', 'database', 1, 'System initialized with initial schema, projects, invoices, and seed accounts.', '127.0.0.1')`,
            [adminId, 'admin@duolink.com']
        );
        console.log('Sample expenses seeding complete!');
    }

    // 8. Seed Partner Transactions if explicitly requested
    const partnerCountRes = await query('SELECT COUNT(*) as count FROM partner_transactions');
    if (process.env.SEED_DEMO_DATA === 'true' && parseInt(partnerCountRes.rows[0].count, 10) === 0) {
        const partnerSeeds = [
            {
                code: 'PTR-101',
                entry_type: 'Income',
                split_type: 'Split',
                partner_name: 'ALL',
                total_amount: 10000.00,
                amount_r: 3333.33,
                amount_v: 3333.33,
                amount_d: 3333.34,
                description: 'Client Project Retainer Payment (Divided equally by 3)',
                date: '2026-10-25',
                notes: '10000 / 3 split among R, V, D'
            },
            {
                code: 'PTR-102',
                entry_type: 'Income',
                split_type: 'Individual',
                partner_name: 'R',
                total_amount: 5000.00,
                amount_r: 5000.00,
                amount_v: 0.00,
                amount_d: 0.00,
                description: 'Direct Architecture Consulting (Partner R)',
                date: '2026-10-26',
                notes: 'Individual Income for R'
            },
            {
                code: 'PTR-103',
                entry_type: 'Expense',
                split_type: 'Split',
                partner_name: 'ALL',
                total_amount: 3000.00,
                amount_r: 1000.00,
                amount_v: 1000.00,
                amount_d: 1000.00,
                description: 'Co-working Office Rent & Utilities (Divided equally by 3)',
                date: '2026-10-27',
                notes: '3000 / 3 split among R, V, D'
            },
            {
                code: 'PTR-104',
                entry_type: 'Expense',
                split_type: 'Individual',
                partner_name: 'V',
                total_amount: 1200.00,
                amount_r: 0.00,
                amount_v: 1200.00,
                amount_d: 0.00,
                description: 'Client Travel & Entertainment (Partner V)',
                date: '2026-10-28',
                notes: 'Individual Expense for V'
            }
        ];

        for (const p of partnerSeeds) {
            await query(
                `INSERT INTO partner_transactions (transaction_code, entry_type, split_type, partner_name, total_amount, amount_r, amount_v, amount_d, description, transaction_date, notes, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [p.code, p.entry_type, p.split_type, p.partner_name, p.total_amount, p.amount_r, p.amount_v, p.amount_d, p.description, p.date, p.notes, adminId]
            );
        }
        console.log('Sample partner transactions (R, V, D) seeded successfully.');
    }
}

module.exports = { runMigrationsAndSeed };
