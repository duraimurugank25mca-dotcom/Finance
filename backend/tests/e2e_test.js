const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
    console.log('====================================================');
    console.log(' Starting Duolink Finance Comprehensive Verification');
    console.log('====================================================\n');

    // 1. Admin Login
    console.log('Test 1: Admin Authentication');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@duolink.com', password: 'Admin@123' }),
    }).then((r) => r.json());

    assert.strictEqual(adminLoginRes.success, true, 'Admin login should succeed');
    assert.strictEqual(adminLoginRes.user.role, 'Admin', 'Admin role must be Admin');
    const adminToken = adminLoginRes.token;
    console.log('✔ Admin login verified successfully.');

    // 2. User Login
    console.log('\nTest 2: Standard User Authentication');
    const userLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@duolink.com', password: 'User@123' }),
    }).then((r) => r.json());

    assert.strictEqual(userLoginRes.success, true, 'User login should succeed');
    assert.strictEqual(userLoginRes.user.role, 'User', 'User role must be User');
    const userToken = userLoginRes.token;
    console.log('✔ User login verified successfully.');

    // 3. Main Dashboard Calculations
    console.log('\nTest 3: Dashboard Financial Calculations');
    const summary = await fetch(`${BASE_URL}/reports/dashboard-summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    assert.strictEqual(summary.success, true);
    const d = summary.data;
    console.log('   Total Income:           $', d.total_income);
    console.log('   Total Expenses:         $', d.total_expenses);
    console.log('   Available Balance:      $', d.available_balance);
    console.log('   Advances Received:      $', d.advances_received);
    console.log('   Pending Client Payments:$', d.pending_client_payments);
    console.log('   Project Profit:         $', d.project_profit);

    // Verify formula: Available Balance = Total Income - Total Expenses
    assert.strictEqual(
        d.available_balance,
        d.total_income - d.total_expenses,
        'Available Balance must equal Total Income - Total Expenses'
    );
    console.log('✔ Financial balance formula mathematically verified.');

    // 4. Role-Based Access Control: User Management access restriction
    console.log('\nTest 4: RBAC Security - User Management Access Restriction');
    const userMgmtAttempt = await fetch(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(userMgmtAttempt.status, 403, 'User must be forbidden (403) from accessing User Management');
    console.log('✔ Non-admin access to User Management strictly blocked with 403 Forbidden.');

    // 5. Admin lists users
    console.log('\nTest 5: Admin User Management');
    const usersList = await fetch(`${BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());
    assert.strictEqual(usersList.success, true);
    assert.ok(usersList.count >= 2, 'Should have at least Admin and User');
    console.log(`✔ Admin retrieved ${usersList.count} user accounts.`);

    // 6. Project Management: Create Project as Admin
    console.log('\nTest 6: Project Creation Workflow');
    const newProject = await fetch(`${BASE_URL}/projects`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
            name: 'AI Automated Financial Ledger Platform',
            client_name: 'Nexus FinTech Global',
            client_email: 'accounts@nexusft.com',
            contract_amount: 50000.00,
            advance_received: 10000.00,
            start_date: '2026-10-26',
            status: 'In Progress',
            description: 'Automated treasury and invoice reconciliation engine.',
        }),
    }).then((r) => r.json());

    assert.strictEqual(newProject.success, true);
    const createdProjectId = newProject.data.id;
    console.log(`✔ Project created successfully with code: ${newProject.data.project_code}`);

    // 7. Expense Registration Workflow
    console.log('\nTest 7: Expense Registration & Calculation');
    const newExpense = await fetch(`${BASE_URL}/expenses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
            category_name: 'Software and Subscriptions',
            description: 'Docker Hub & GitHub Enterprise Cloud licenses',
            amount: 450.00,
            expense_date: '2026-10-26',
            payment_method: 'Credit Card',
            project_id: createdProjectId,
            paid_by: 'Corporate Visa *4421',
            notes: 'CI/CD pipeline infrastructure',
        }),
    }).then((r) => r.json());

    assert.strictEqual(newExpense.success, true);
    console.log(`✔ Expense recorded with code: ${newExpense.data.expense_code} for $${newExpense.data.amount}`);

    // 8. Duolink Bill / Invoice Generation
    console.log('\nTest 8: Bill Generation with Itemized Breakdown');
    const newInvoice = await fetch(`${BASE_URL}/invoices`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
            project_id: createdProjectId,
            invoice_date: '2026-10-26',
            due_date: '2026-11-10',
            advance_deduction: 2000.00,
            payment_terms: 'Net 15 days upon milestone completion.',
            items: [
                { description: 'Cloud Architecture & Microservices Design', quantity: 1, unit_price: 15000.00 },
                { description: 'Smart Contract & Transaction Ledger Modules', quantity: 1, unit_price: 10000.00 },
            ],
        }),
    }).then((r) => r.json());

    assert.strictEqual(newInvoice.success, true);
    const createdInvoiceId = newInvoice.data.id;
    console.log(`✔ Invoice generated: ${newInvoice.data.invoice_number} (Total: $${newInvoice.data.total_amount})`);

    // 9. PDF Generation & Streaming
    console.log('\nTest 9: PDF Invoice Streaming');
    const pdfStream = await fetch(`${BASE_URL}/invoices/${createdInvoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(pdfStream.status, 200);
    assert.strictEqual(pdfStream.headers.get('content-type'), 'application/pdf');
    const pdfBuffer = await pdfStream.arrayBuffer();
    assert.ok(pdfBuffer.byteLength > 1000, 'PDF buffer should contain valid PDF bytes');
    console.log(`✔ PDF generated and streamed cleanly (${pdfBuffer.byteLength} bytes).`);

    // 10. Partial Payment Settlement
    console.log('\nTest 10: Partial Payment Settlement Workflow');
    const payRes = await fetch(`${BASE_URL}/invoices/${createdInvoiceId}/payments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
            amount: 10000.00,
            payment_date: '2026-10-26',
            payment_method: 'Bank Transfer',
            transaction_reference: 'WIRE-NEXUS-8849',
        }),
    }).then((r) => r.json());
    assert.strictEqual(payRes.success, true);

    const updatedInv = await fetch(`${BASE_URL}/invoices/${createdInvoiceId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    }).then((r) => r.json());

    assert.strictEqual(updatedInv.data.status, 'Partially Paid');
    console.log(`✔ Partial payment recorded. Invoice status: ${updatedInv.data.status}, Remaining: $${updatedInv.data.remaining_balance}`);

    // 11. Reports & CSV Export
    console.log('\nTest 11: Financial Reports & CSV Export');
    const csvExport = await fetch(`${BASE_URL}/reports/export-csv?type=expenses`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(csvExport.status, 200);
    assert.strictEqual(csvExport.headers.get('content-type'), 'text/csv; charset=utf-8');
    const csvText = await csvExport.text();
    assert.ok(csvText.includes('Code,Date,Category'), 'CSV header should be present');
    console.log('✔ CSV export generated successfully.');

    console.log('\n====================================================');
    console.log(' ALL 11 TEST SUITES PASSED FLAWLESSLY! 100% SUCCESS');
    console.log('====================================================');
}

runTests().catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
});
