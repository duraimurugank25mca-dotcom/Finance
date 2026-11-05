// Duolink Finance Application Controller

let currentUser = null;
let currentProjects = [];
let currentCategories = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();

    const token = Api.getToken();
    let isAuthenticated = false;

    if (token) {
        try {
            const profile = await Api.getProfile();
            currentUser = profile.user;
            isAuthenticated = true;
        } catch (e) {
            Api.clearSession();
            isAuthenticated = false;
        }
    }

    // Show Welcome Page (Logo + Welcome to DUOLINK FINANCE) for 3.5 seconds on site load before login
    const splash = document.getElementById('splash-screen');
    const splashDuration = 3400; // 3.4 seconds

    setTimeout(() => {
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                if (isAuthenticated && currentUser) {
                    renderAuthenticatedApp();
                } else {
                    showLoginScreen();
                }
            }, 400); // 400ms smooth fade out
        } else {
            if (isAuthenticated && currentUser) {
                renderAuthenticatedApp();
            } else {
                showLoginScreen();
            }
        }
    }, splashDuration);
}

function showLoginScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
}

function showLoginSplashScreen(callback) {
    const splash = document.getElementById('splash-screen');
    const loginScreen = document.getElementById('login-screen');
    const welcomeText = document.getElementById('splash-user-welcome');
    
    if (welcomeText && currentUser) {
        welcomeText.textContent = `Welcome back, ${currentUser.fullName}!`;
    }

    if (loginScreen) loginScreen.style.display = 'none';
    if (splash) {
        splash.style.display = 'flex';
        splash.style.opacity = '1';

        // 3.5 seconds duration (between 3 and 4 seconds as requested)
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
                if (callback) callback();
            }, 400); // 400ms smooth fade out
        }, 3400);
    } else {
        if (callback) callback();
    }
}

function getActivePartnerCode() {
    if (!currentUser) return 'D';
    if (currentUser.partnerCode) return currentUser.partnerCode.toUpperCase();
    if (currentUser.email) {
        const em = currentUser.email.toLowerCase();
        if (em.startsWith('d@') || em.includes('partner.d')) return 'D';
        if (em.startsWith('r@') || em.includes('partner.r')) return 'R';
        if (em.startsWith('v@') || em.includes('partner.v')) return 'V';
    }
    return 'D';
}

function renderAuthenticatedApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';

    // Update User metadata in UI
    const partnerCode = getActivePartnerCode();
    document.getElementById('sidebar-user-name').textContent = currentUser.fullName;
    document.getElementById('sidebar-avatar').textContent = partnerCode;

    const roleBadge = document.getElementById('sidebar-role-badge');
    roleBadge.textContent = `${currentUser.role} (${partnerCode})`;
    roleBadge.className = `user-role-badge role-${currentUser.role.toLowerCase()}`;

    // Admin vs User Role Visibility
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach((el) => {
        el.style.display = currentUser.role === 'Admin' ? '' : 'none';
    });

    // Style active partner button in header
    ['d', 'r', 'v'].forEach(p => {
        const btn = document.getElementById(`switch-partner-${p}`);
        if (btn) {
            const isActive = partnerCode === p.toUpperCase();
            btn.style.background = isActive ? (p === 'd' ? '#f59e0b' : (p === 'r' ? '#3b82f6' : '#10b981')) : 'transparent';
            btn.style.color = isActive ? '#ffffff' : 'var(--text-primary)';
            btn.style.border = isActive ? 'none' : '1px solid transparent';
        }
    });

    // Load initial views
    navigateTo('dashboard');
    loadCategories();
    loadProjectsDropdown();
}

// Quick Switch Partner Admin (D, R, V)
async function switchPartnerAdmin(email) {
    try {
        const res = await Api.login(email, 'Admin@123');
        Api.setSession(res.token, res.user);
        currentUser = res.user;
        showToast(`Signed in as ${res.user.fullName} (${res.user.role})`, 'success');
        renderAuthenticatedApp();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Mobile Sidebar Drawer Toggle
function toggleMobileSidebar(forceState) {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    const isOpen = sidebar.classList.contains('open');
    const newState = typeof forceState === 'boolean' ? forceState : !isOpen;

    if (newState) {
        sidebar.classList.add('open');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar.classList.remove('open');
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Navigation Router
function navigateTo(viewName) {
    if (window.innerWidth <= 900) {
        toggleMobileSidebar(false);
    }

    // Hide all views
    document.querySelectorAll('.page-view').forEach((el) => (el.style.display = 'none'));

    // Highlight nav link
    document.querySelectorAll('.nav-link').forEach((el) => {
        el.classList.toggle('active', el.getAttribute('data-view') === viewName);
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
        targetView.style.display = 'block';
    }

    // Page titles
    const titles = {
        dashboard: 'Dashboard Overview',
        projects: 'Projects & Accounts',
        'project-details': 'Project Financial Statement',
        expenses: 'Expense Management',
        income: 'Income & Advance Payments',
        invoices: 'Duolink Invoices & Bills',
        partners: 'Partner',
        attachments: 'Proof Documents & Receipts',
        reports: 'Financial Reports & Analytics',
        users: 'User Account Management',
        profile: 'Profile & Security Settings',
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'Duolink Finance';

    // Fetch view-specific data
    switch (viewName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'projects':
            loadProjects();
            break;
        case 'expenses':
            loadExpenses();
            break;
        case 'income':
            loadIncome();
            break;
        case 'invoices':
            loadInvoices();
            break;
        case 'partners':
            loadPartners();
            break;
        case 'attachments':
            loadAttachments();
            break;
        case 'reports':
            loadReports();
            break;
        case 'users':
            loadUsers();
            break;
        case 'profile':
            loadProfileView();
            break;
    }
}

// 1. DASHBOARD
async function loadDashboard() {
    try {
        const res = await Api.getDashboardSummary();
        const d = res.data;

        document.getElementById('stat-total-income').textContent = formatCurrency(d.total_income);
        document.getElementById('stat-total-expenses').textContent = formatCurrency(d.total_expenses);
        document.getElementById('stat-available-balance').textContent = formatCurrency(d.available_balance);
        document.getElementById('stat-advances').textContent = formatCurrency(d.advances_received);
        document.getElementById('stat-pending-payments').textContent = formatCurrency(d.pending_client_payments);

        document.getElementById('stat-project-income').textContent = formatCurrency(d.total_project_income);
        document.getElementById('stat-project-expenses').textContent = formatCurrency(d.total_project_expenses);
        document.getElementById('stat-project-profit').textContent = formatCurrency(d.project_profit);

        // Load Partner Spotlight on Dashboard
        loadPartnerSummary();

        // Recent Income Table
        const incomeTbody = document.getElementById('table-recent-income');
        if (d.recent_activity.income.length === 0) {
            incomeTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent income</td></tr>';
        } else {
            incomeTbody.innerHTML = d.recent_activity.income
                .map(
                    (r) => `
                <tr>
                    <td><b>${r.code}</b></td>
                    <td>${r.client_name}</td>
                    <td style="color:var(--accent-green); font-weight:700;">${formatCurrency(r.amount)}</td>
                    <td>${formatDate(r.payment_date)}</td>
                </tr>
            `
                )
                .join('');
        }

        // Recent Expense Table
        const expenseTbody = document.getElementById('table-recent-expenses');
        if (d.recent_activity.expenses.length === 0) {
            expenseTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No recent expenses</td></tr>';
        } else {
            expenseTbody.innerHTML = d.recent_activity.expenses
                .map(
                    (r) => `
                <tr>
                    <td><b>${r.code}</b></td>
                    <td><span class="badge badge-gray">${r.category_name}</span></td>
                    <td style="color:var(--accent-red); font-weight:700;">${formatCurrency(r.amount)}</td>
                    <td>${formatDate(r.expense_date)}</td>
                </tr>
            `
                )
                .join('');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 2. PROJECTS
async function loadProjects() {
    try {
        const res = await Api.getProjects();
        currentProjects = res.data;
        const tbody = document.getElementById('table-projects');

        if (currentProjects.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No projects found.</td></tr>';
            return;
        }

        tbody.innerHTML = currentProjects
            .map((p) => {
                const profitColor = p.project_profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                return `
                <tr>
                    <td><b>${p.project_code}</b></td>
                    <td><b>${p.name}</b></td>
                    <td>${p.client_name}</td>
                    <td><span class="badge badge-blue">${p.status}</span></td>
                    <td>${formatCurrency(p.contract_amount)}</td>
                    <td style="color:var(--accent-green); font-weight:600;">${formatCurrency(p.total_income_received)}</td>
                    <td style="color:var(--accent-red); font-weight:600;">${formatCurrency(p.total_expenses)}</td>
                    <td style="color:${profitColor}; font-weight:700;">${formatCurrency(p.project_profit)}</td>
                    <td style="color:var(--accent-amber); font-weight:700;">${formatCurrency(p.pending_payment)}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="viewProjectDetails(${p.id})">Statement</button>
                        ${
                            currentUser.role === 'Admin' || currentUser.canDeleteRecords
                                ? `<button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})">Delete</button>`
                                : ''
                        }
                    </td>
                </tr>
            `;
            })
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 3. PROJECT DETAILS / FINANCIAL STATEMENT
async function viewProjectDetails(id) {
    try {
        const res = await Api.getProjectById(id);
        const p = res.data;

        const container = document.getElementById('project-details-content');
        container.innerHTML = `
            <div class="card" style="margin-bottom:20px;">
                <div class="card-header">
                    <div>
                        <span class="badge badge-blue" style="margin-bottom:4px;">${p.project_code}</span>
                        <h2 style="font-size:20px; font-weight:800; color:var(--primary-900);">${p.name}</h2>
                        <div style="font-size:13px; color:var(--text-secondary); margin-top:2px;">
                            Client: <b>${p.client_name}</b> | Started: ${formatDate(p.start_date)} | Status: <b>${p.status}</b>
                        </div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary btn-sm" onclick="openExpenseModal(${p.id})">+ Add Project Expense</button>
                        <button class="btn btn-primary btn-sm" onclick="openInvoiceModal(${p.id})">+ Generate Bill</button>
                    </div>
                </div>

                <div class="card-body">
                    <!-- Project Financial Summary Cards -->
                    <div class="stats-grid" style="margin-bottom:20px;">
                        <div class="stat-card">
                            <div class="stat-label">Contract Value</div>
                            <div class="stat-value">${formatCurrency(p.contract_amount)}</div>
                        </div>
                        <div class="stat-card income">
                            <div class="stat-label">Total Cash Income Received</div>
                            <div class="stat-value" style="color:var(--accent-green);">${formatCurrency(p.total_income)}</div>
                        </div>
                        <div class="stat-card expense">
                            <div class="stat-label">Project Expenses</div>
                            <div class="stat-value" style="color:var(--accent-red);">${formatCurrency(p.total_expenses)}</div>
                        </div>
                        <div class="stat-card balance">
                            <div class="stat-label">Project Profit / Margin</div>
                            <div class="stat-value">${formatCurrency(p.project_profit)}</div>
                        </div>
                        <div class="stat-card pending">
                            <div class="stat-label">Pending Client Balance</div>
                            <div class="stat-value" style="color:var(--accent-amber);">${formatCurrency(p.pending_payment)}</div>
                        </div>
                    </div>

                    <!-- Invoices on Project -->
                    <h3 style="font-size:15px; font-weight:700; margin:20px 0 10px; color:var(--primary-900);">Project Invoices & Bills</h3>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Date</th>
                                    <th>Total ($)</th>
                                    <th>Advance Ded.</th>
                                    <th>Payments Recv.</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${
                                    p.invoices.length === 0
                                        ? '<tr><td colspan="7" style="text-align:center;">No invoices yet for this project.</td></tr>'
                                        : p.invoices
                                              .map(
                                                  (inv) => `
                                    <tr>
                                        <td><b>${inv.invoice_number}</b></td>
                                        <td>${formatDate(inv.invoice_date)}</td>
                                        <td>${formatCurrency(inv.total_amount)}</td>
                                        <td>${formatCurrency(inv.advance_deduction)}</td>
                                        <td style="color:var(--accent-green); font-weight:700;">${formatCurrency(inv.payments_received)}</td>
                                        <td><span class="badge badge-blue">${inv.status}</span></td>
                                        <td>
                                            <a class="btn btn-secondary btn-sm" href="/api/invoices/${inv.id}/pdf${Api.getToken() ? '?token=' + encodeURIComponent(Api.getToken()) : ''}" target="_blank" onclick="openInvoicePdf(${inv.id}); return false;">📄 View PDF</a>
                                        </td>
                                    </tr>
                                `
                                              )
                                              .join('')
                                }
                            </tbody>
                        </table>
                    </div>

                    <!-- Project Expenses List -->
                    <h3 style="font-size:15px; font-weight:700; margin:25px 0 10px; color:var(--primary-900);">Project Expenses</h3>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Paid By</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${
                                    p.expenses.length === 0
                                        ? '<tr><td colspan="6" style="text-align:center;">No project expenses recorded.</td></tr>'
                                        : p.expenses
                                              .map(
                                                  (e) => `
                                    <tr>
                                        <td><b>${e.expense_code}</b></td>
                                        <td><span class="badge badge-gray">${e.category_name}</span></td>
                                        <td>${e.description}</td>
                                        <td style="color:var(--accent-red); font-weight:700;">${formatCurrency(e.amount)}</td>
                                        <td>${formatDate(e.expense_date)}</td>
                                        <td>${e.paid_by}</td>
                                    </tr>
                                `
                                              )
                                              .join('')
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        navigateTo('project-details');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 4. EXPENSES
async function loadExpenses() {
    try {
        const category = document.getElementById('filter-expense-category').value;
        const startDate = document.getElementById('filter-expense-start').value;
        const endDate = document.getElementById('filter-expense-end').value;

        const res = await Api.getExpenses({ category, startDate, endDate });
        const tbody = document.getElementById('table-expenses');

        document.getElementById('expense-total-display').textContent = `Total: ${formatCurrency(res.total_amount)}`;

        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No expense records found.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data
            .map((e) => {
                const canDelete = currentUser.role === 'Admin' || (currentUser.canDeleteRecords && e.user_id === currentUser.id);
                return `
                <tr>
                    <td><b>${e.expense_code}</b></td>
                    <td>${formatDate(e.expense_date)}</td>
                    <td><span class="badge badge-gray">${e.category_name}</span></td>
                    <td>${e.description}</td>
                    <td style="color:var(--accent-red); font-weight:700;">${formatCurrency(e.amount)}</td>
                    <td>${e.payment_method}</td>
                    <td>${e.project_name || '<span style="color:var(--text-muted);">Company General</span>'}</td>
                    <td>${e.paid_by}</td>
                    <td>
                        ${
                            e.receipt_url
                                ? `<a href="${e.receipt_url}" target="_blank" class="btn btn-secondary btn-sm" style="padding:2px 8px;">📎 Receipt</a>`
                                : '<span style="color:var(--text-muted); font-size:12px;">No proof</span>'
                        }
                    </td>
                    <td>
                        ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteExpense(${e.id})">Delete</button>` : '—'}
                    </td>
                </tr>
            `;
            })
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 5. INCOME & ADVANCES
async function loadIncome() {
    try {
        const res = await Api.getIncome();
        const tbody = document.getElementById('table-income');

        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No income records found.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data
            .map((r) => {
                const typeBadge = r.is_advance ? '<span class="badge badge-amber">Advance</span>' : '<span class="badge badge-green">Payment / Income</span>';
                return `
                <tr>
                    <td><b>${r.income_code}</b></td>
                    <td>${formatDate(r.payment_date)}</td>
                    <td><b>${r.client_name}</b></td>
                    <td style="color:var(--accent-green); font-weight:700;">${formatCurrency(r.amount)}</td>
                    <td>${typeBadge}</td>
                    <td>${r.project_type ? `<span class="badge badge-blue">${r.project_type}</span>` : (r.project_name || '<span style="color:var(--text-muted);">General</span>')}</td>
                    <td>${r.payment_method}</td>
                    <td>${r.project_details ? `<span title="${r.project_details}">${r.project_details.length > 35 ? r.project_details.substring(0, 35) + '...' : r.project_details}</span>` : (r.transaction_reference ? `<code>${r.transaction_reference}</code>` : '<span style="color:var(--text-muted);">—</span>')}</td>
                    <td>
                        ${
                            r.proof_attachment
                                ? `<a href="${r.proof_attachment}" target="_blank" class="btn btn-secondary btn-sm" style="padding:2px 8px;">Proof</a>`
                                : '<span style="color:var(--text-muted); font-size:12px;">—</span>'
                        }
                    </td>
                </tr>
            `;
            })
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 6. INVOICES
async function loadInvoices() {
    try {
        const res = await Api.getInvoices();
        const tbody = document.getElementById('table-invoices');

        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No invoices found.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data
            .map((inv) => {
                let statusBadge = 'badge-blue';
                if (inv.status === 'Paid') statusBadge = 'badge-green';
                if (inv.status === 'Partially Paid') statusBadge = 'badge-amber';

                return `
                <tr>
                    <td><b>${inv.invoice_number}</b></td>
                    <td>${formatDate(inv.invoice_date)}</td>
                    <td><b>${inv.project_name}</b></td>
                    <td>${inv.client_name}</td>
                    <td>${formatCurrency(inv.total_amount)}</td>
                    <td>${formatCurrency(inv.advance_deduction)}</td>
                    <td style="color:var(--accent-green); font-weight:700;">${formatCurrency(inv.payments_received)}</td>
                    <td style="color:var(--accent-red); font-weight:700;">${formatCurrency(inv.remaining_balance)}</td>
                    <td><span class="badge ${statusBadge}">${inv.status}</span></td>
                    <td style="display:flex; gap:6px;">
                        <a href="/api/invoices/${inv.id}/pdf${Api.getToken() ? '?token=' + encodeURIComponent(Api.getToken()) : ''}" target="_blank" class="btn btn-secondary btn-sm" onclick="openInvoicePdf(${inv.id}); return false;">
                            📄 PDF Bill
                        </a>
                        ${
                            inv.remaining_balance > 0
                                ? `<button class="btn btn-primary btn-sm" onclick="openInvoicePaymentModal(${inv.id}, '${inv.invoice_number}', ${inv.remaining_balance})">
                                    💰 Pay
                                   </button>`
                                : ''
                        }
                    </td>
                </tr>
            `;
            })
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Open Invoice PDF Bill Viewer
function openInvoicePdf(invoiceId) {
    if (!invoiceId) return;
    const token = Api.getToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `/api/invoices/${invoiceId}/pdf${tokenParam}`;
    const win = window.open(url, '_blank');
    if (!win) {
        window.location.href = url;
    }
}

// 7. ATTACHMENTS
async function loadAttachments() {
    try {
        const res = await Api.getAttachments();
        const tbody = document.getElementById('table-attachments');

        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No proof attachments found.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data
            .map(
                (a) => `
            <tr>
                <td><b>${a.original_name}</b></td>
                <td><span class="badge badge-blue">${a.entity_type.toUpperCase()} #${a.entity_id}</span></td>
                <td>${a.file_type || 'Unknown'}</td>
                <td>${Math.round((a.file_size || 0) / 1024)} KB</td>
                <td>${a.uploader_name || 'System'}</td>
                <td>${formatDate(a.created_at)}</td>
                <td>
                    <a href="${a.file_path}" target="_blank" class="btn btn-secondary btn-sm">View Document</a>
                </td>
            </tr>
        `
            )
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 8. REPORTS & ANALYTICS
async function loadReports() {
    try {
        const year = document.getElementById('report-year').value;
        const res = await Api.getFinancialReports(year);

        // Monthly Breakdown
        const monthlyTbody = document.getElementById('table-monthly-reports');
        monthlyTbody.innerHTML = res.monthly_breakdown
            .map((m) => {
                const netColor = m.net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                const trend = m.net >= 0 ? '▲ Profitable' : '▼ Deficit';
                return `
                <tr>
                    <td><b>${m.monthName} ${res.year}</b></td>
                    <td style="color:var(--accent-green); font-weight:600;">${formatCurrency(m.income)}</td>
                    <td style="color:var(--accent-red); font-weight:600;">${formatCurrency(m.expense)}</td>
                    <td style="color:${netColor}; font-weight:800;">${formatCurrency(m.net)}</td>
                    <td><span class="badge ${m.net >= 0 ? 'badge-green' : 'badge-red'}">${trend}</span></td>
                </tr>
            `;
            })
            .join('');

        // Project P&L
        const plTbody = document.getElementById('table-project-pl');
        plTbody.innerHTML = res.project_profit_loss
            .map((p) => {
                const plColor = p.profit_loss >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                return `
                <tr>
                    <td><b>${p.name}</b></td>
                    <td>${formatCurrency(p.total_income)}</td>
                    <td>${formatCurrency(p.total_expenses)}</td>
                    <td style="color:${plColor}; font-weight:700;">${formatCurrency(p.profit_loss)}</td>
                </tr>
            `;
            })
            .join('');

        // Category Analysis
        const catTbody = document.getElementById('table-category-analysis');
        catTbody.innerHTML = res.category_analysis
            .map(
                (c) => `
            <tr>
                <td><b>${c.category_name}</b></td>
                <td>${c.count} transactions</td>
                <td style="color:var(--accent-red); font-weight:700;">${formatCurrency(c.total)}</td>
            </tr>
        `
            )
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 9. USERS (Admin Only)
async function loadUsers() {
    try {
        const res = await Api.getUsers();
        const tbody = document.getElementById('table-users');

        tbody.innerHTML = res.data
            .map((u) => {
                return `
                <tr>
                    <td><b>${u.full_name}</b></td>
                    <td>${u.email}</td>
                    <td><span class="user-role-badge role-${u.role.toLowerCase()}">${u.role}</span></td>
                    <td>${u.can_create_project ? '✅ Yes' : '❌ No'}</td>
                    <td>${u.can_edit_records ? '✅ Yes' : '❌ No'}</td>
                    <td>${u.can_delete_records ? '✅ Yes' : '❌ No'}</td>
                    <td><span class="badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}">${u.status}</span></td>
                    <td>
                        ${
                            u.id !== currentUser.id
                                ? `<button class="btn btn-secondary btn-sm" onclick="toggleUserStatus(${u.id}, '${u.status === 'active' ? 'inactive' : 'active'}')">
                                    ${u.status === 'active' ? 'Deactivate' : 'Activate'}
                                   </button>`
                                : '<span style="color:var(--text-muted); font-size:12px;">Current Session</span>'
                        }
                    </td>
                </tr>
            `;
            })
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleUserStatus(id, newStatus) {
    try {
        await Api.updateUser(id, { status: newStatus });
        showToast(`User status updated to ${newStatus}.`, 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 10. PROFILE VIEW
function loadProfileView() {
    document.getElementById('profile-name').textContent = currentUser.fullName;
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('profile-avatar').textContent = currentUser.fullName.charAt(0).toUpperCase();

    const roleBadge = document.getElementById('profile-role');
    roleBadge.textContent = currentUser.role;
    roleBadge.className = `user-role-badge role-${currentUser.role.toLowerCase()}`;

    document.getElementById('perm-create-proj').innerHTML = `✓ Project Creation: <b>${currentUser.role === 'Admin' || currentUser.canCreateProject ? 'Enabled' : 'Restricted'}</b>`;
    document.getElementById('perm-edit-rec').innerHTML = `✓ Edit Records: <b>${currentUser.role === 'Admin' || currentUser.canEditRecords ? 'Enabled' : 'Restricted'}</b>`;
    document.getElementById('perm-del-rec').innerHTML = `✓ Delete Records: <b>${currentUser.role === 'Admin' || currentUser.canDeleteRecords ? 'Enabled' : 'Restricted'}</b>`;
}

// MODAL CONTROLLERS & FORM HANDLERS

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Add Project Modal
function openProjectModal() {
    document.getElementById('form-project').reset();
    document.getElementById('proj-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-project');
}

// Add Expense Modal
async function openExpenseModal(preselectedProjectId = null) {
    document.getElementById('form-expense').reset();
    document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];

    // Populate category dropdown
    const catSelect = document.getElementById('exp-category');
    catSelect.innerHTML = currentCategories.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');

    // Populate project dropdown
    const projSelect = document.getElementById('exp-project');
    projSelect.innerHTML =
        '<option value="">None (Company Operating Expense)</option>' +
        currentProjects.map((p) => `<option value="${p.id}">${p.project_code} - ${p.name}</option>`).join('');

    if (preselectedProjectId) {
        projSelect.value = preselectedProjectId;
    }

    openModal('modal-expense');
}

// Add Income Modal
function openIncomeModal() {
    document.getElementById('form-income').reset();
    document.getElementById('inc-date').value = new Date().toISOString().split('T')[0];
    const projectTypeInput = document.getElementById('inc-project-type');
    if (projectTypeInput) projectTypeInput.value = '';
    openModal('modal-income');
}

// Generate Invoice Modal
function openInvoiceModal(preselectedProjectId = null) {
    document.getElementById('form-invoice').reset();
    document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];

    // Populate projects
    const projSelect = document.getElementById('inv-project');
    projSelect.innerHTML = currentProjects.map((p) => `<option value="${p.id}">${p.project_code} - ${p.name} (${p.client_name})</option>`).join('');

    if (preselectedProjectId) {
        projSelect.value = preselectedProjectId;
    }

    // Default item row
    const container = document.getElementById('invoice-items-container');
    container.innerHTML = '';
    addInvoiceItemRow('Professional Financial & Engineering Services Milestone 1', 1, 5000);

    calculateInvoiceTotal();
    openModal('modal-invoice');
}

function addInvoiceItemRow(desc = '', qty = 1, rate = 0) {
    const container = document.getElementById('invoice-items-container');
    const row = document.createElement('div');
    row.className = 'form-row item-row';
    row.style.marginBottom = '8px';
    row.innerHTML = `
        <div style="flex:3;">
            <input type="text" class="form-control item-desc" placeholder="Service description..." value="${desc}" required>
        </div>
        <div style="flex:1;">
            <input type="number" step="1" min="1" class="form-control item-qty" placeholder="Qty" value="${qty}" onchange="calculateInvoiceTotal()" required>
        </div>
        <div style="flex:1.5;">
            <input type="number" step="0.01" class="form-control item-rate" placeholder="Rate (₹)" value="${rate}" onchange="calculateInvoiceTotal()" required>
        </div>
        <div>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.item-row').remove(); calculateInvoiceTotal();">✕</button>
        </div>
    `;
    container.appendChild(row);
}

function calculateInvoiceTotal() {
    let subtotal = 0;
    document.querySelectorAll('.item-row').forEach((row) => {
        const qty = parseFloat(row.querySelector('.item-qty').value || 0);
        const rate = parseFloat(row.querySelector('.item-rate').value || 0);
        subtotal += qty * rate;
    });

    const advanceDed = parseFloat(document.getElementById('inv-advance-ded').value || 0);
    const net = Math.max(0, subtotal - advanceDed);

    document.getElementById('inv-calculated-net').value = `${formatCurrency(net)} (Subtotal: ${formatCurrency(subtotal)})`;
}

// Record Invoice Payment Modal
function openInvoicePaymentModal(invId, invNumber, remaining) {
    document.getElementById('inv-pay-id').value = invId;
    document.getElementById('inv-pay-num').value = invNumber;
    document.getElementById('inv-pay-amount').value = remaining.toFixed(2);
    document.getElementById('inv-pay-date').value = new Date().toISOString().split('T')[0];
    openModal('modal-invoice-payment');
}

// User Modal
function openUserModal() {
    document.getElementById('form-user').reset();
    openModal('modal-user');
}

// Attachment Modal
function openAttachmentModal() {
    document.getElementById('form-attachment').reset();
    updateAttachmentEntityOptions();
    openModal('modal-attachment');
}

function updateAttachmentEntityOptions() {
    const type = document.getElementById('att-entity-type').value;
    const select = document.getElementById('att-entity-id');

    if (type === 'project') {
        select.innerHTML = currentProjects.map((p) => `<option value="${p.id}">${p.project_code} - ${p.name}</option>`).join('');
    } else {
        select.innerHTML = '<option value="1">Record #1</option><option value="2">Record #2</option>';
    }
}

// HELPERS & EVENT LISTENERS
function setupEventListeners() {
    // Navigation clicks
    document.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.getAttribute('data-view');
            if (view) navigateTo(view);
        });
    });

    // Login Form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('btn-login');

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Authenticating...';
            }
            const res = await Api.login(email, password);
            Api.setSession(res.token, res.user);
            currentUser = res.user;

            showToast('Welcome back, ' + currentUser.fullName, 'success');
            renderAuthenticatedApp();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In to Workspace';
            }
        }
    });

    // Project Form
    document.getElementById('form-project').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            name: document.getElementById('proj-name').value,
            client_name: document.getElementById('proj-client').value,
            client_email: document.getElementById('proj-client-email').value,
            client_phone: document.getElementById('proj-client-phone').value,
            contract_amount: parseFloat(document.getElementById('proj-contract').value),
            advance_received: parseFloat(document.getElementById('proj-advance').value || 0),
            start_date: document.getElementById('proj-date').value,
            status: 'In Progress',
            description: document.getElementById('proj-desc').value,
            notes: '',
        };

        try {
            await Api.createProject(payload);
            showToast('Project created successfully!', 'success');
            closeModal('modal-project');
            loadProjects();
            loadProjectsDropdown();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Expense Form
    document.getElementById('form-expense').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('category_name', document.getElementById('exp-category').value);
        formData.append('amount', document.getElementById('exp-amount').value);
        formData.append('description', document.getElementById('exp-desc').value);
        formData.append('expense_date', document.getElementById('exp-date').value);
        formData.append('payment_method', document.getElementById('exp-method').value);
        formData.append('paid_by', document.getElementById('exp-paid-by').value);
        formData.append('notes', document.getElementById('exp-notes').value);

        const projId = document.getElementById('exp-project').value;
        if (projId) formData.append('project_id', projId);

        const fileInput = document.getElementById('exp-receipt');
        if (fileInput.files[0]) {
            formData.append('receipt', fileInput.files[0]);
        }

        try {
            await Api.createExpense(formData);
            showToast('Expense recorded successfully!', 'success');
            closeModal('modal-expense');
            loadExpenses();
            loadDashboard();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Add Income Form
    document.getElementById('form-income').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('client_name', document.getElementById('inc-client').value);
        formData.append('amount', document.getElementById('inc-amount').value);
        formData.append('payment_date', document.getElementById('inc-date').value);
        formData.append('payment_method', document.getElementById('inc-method').value);
        formData.append('is_advance', 'false');

        const projectType = document.getElementById('inc-project-type') ? document.getElementById('inc-project-type').value.trim() : '';
        if (projectType) formData.append('project_type', projectType);

        const projectDetails = document.getElementById('inc-project-details') ? document.getElementById('inc-project-details').value : '';
        if (projectDetails) formData.append('project_details', projectDetails);

        const fileInput = document.getElementById('inc-proof');
        if (fileInput.files[0]) {
            formData.append('proof', fileInput.files[0]);
        }

        try {
            await Api.recordIncome(formData);
            showToast('Income added successfully!', 'success');
            closeModal('modal-income');
            loadIncome();
            loadDashboard();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Invoice Form
    document.getElementById('form-invoice').addEventListener('submit', async (e) => {
        e.preventDefault();

        const items = [];
        document.querySelectorAll('.item-row').forEach((row) => {
            items.push({
                description: row.querySelector('.item-desc').value,
                quantity: parseFloat(row.querySelector('.item-qty').value || 1),
                unit_price: parseFloat(row.querySelector('.item-rate').value || 0),
            });
        });

        const payload = {
            project_id: parseInt(document.getElementById('inv-project').value, 10),
            invoice_date: document.getElementById('inv-date').value,
            due_date: document.getElementById('inv-due-date').value,
            advance_deduction: parseFloat(document.getElementById('inv-advance-ded').value || 0),
            payment_terms: document.getElementById('inv-terms').value,
            items,
        };

        try {
            const res = await Api.createInvoice(payload);
            const created = res.data;
            closeModal('modal-invoice');
            loadInvoices();
            loadDashboard();

            const token = Api.getToken();
            const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
            const pdfUrl = `/api/invoices/${created.id}/pdf${tokenParam}`;

            showToast(`Invoice ${created.invoice_number} created successfully! <a href="${pdfUrl}" target="_blank" style="color:#ffffff; text-decoration:underline; font-weight:800; margin-left:8px;" onclick="openInvoicePdf(${created.id}); return false;">📄 View PDF</a>`, 'success');

            // Open the generated PDF bill automatically
            if (created && created.id) {
                setTimeout(() => {
                    openInvoicePdf(created.id);
                }, 300);
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Invoice Payment Form
    document.getElementById('form-invoice-payment').addEventListener('submit', async (e) => {
        e.preventDefault();
        const invoiceId = document.getElementById('inv-pay-id').value;
        const formData = new FormData();
        formData.append('amount', document.getElementById('inv-pay-amount').value);
        formData.append('payment_date', document.getElementById('inv-pay-date').value);
        formData.append('payment_method', document.getElementById('inv-pay-method').value);
        formData.append('transaction_reference', document.getElementById('inv-pay-ref').value);

        try {
            await Api.recordInvoicePayment(invoiceId, formData);
            showToast('Invoice payment settled successfully!', 'success');
            closeModal('modal-invoice-payment');
            loadInvoices();
            loadDashboard();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // User Form
    document.getElementById('form-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            full_name: document.getElementById('user-name').value,
            email: document.getElementById('user-email').value,
            password: document.getElementById('user-password').value,
            role: document.getElementById('user-role').value,
            can_create_project: document.getElementById('user-can-create-proj').checked,
            can_edit_records: document.getElementById('user-can-edit').checked,
            can_delete_records: document.getElementById('user-can-delete').checked,
        };

        try {
            await Api.createUser(payload);
            showToast('User account created!', 'success');
            closeModal('modal-user');
            loadUsers();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Password Form
    document.getElementById('form-change-password').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cur = document.getElementById('pw-current').value;
        const nw = document.getElementById('pw-new').value;
        const conf = document.getElementById('pw-confirm').value;

        if (nw !== conf) {
            showToast('New passwords do not match!', 'error');
            return;
        }

        try {
            await Api.changePassword(cur, nw);
            showToast('Password updated successfully!', 'success');
            document.getElementById('form-change-password').reset();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Attachment Form
    document.getElementById('form-attachment').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('entity_type', document.getElementById('att-entity-type').value);
        formData.append('entity_id', document.getElementById('att-entity-id').value);
        formData.append('file', document.getElementById('att-file').files[0]);

        try {
            await Api.uploadAttachment(formData);
            showToast('Attachment uploaded successfully!', 'success');
            closeModal('modal-attachment');
            loadAttachments();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Partner Form
    const partnerForm = document.getElementById('form-partner');
    if (partnerForm) {
        partnerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                entry_type: document.getElementById('ptr-entry-type').value,
                split_type: document.getElementById('ptr-split-type').value,
                partner_name: document.getElementById('ptr-partner-name').value,
                total_amount: parseFloat(document.getElementById('ptr-amount').value),
                description: document.getElementById('ptr-desc').value,
                transaction_date: document.getElementById('ptr-date').value,
                notes: document.getElementById('ptr-notes').value,
            };

            try {
                await Api.createPartnerTransaction(payload);
                showToast(`Partner ${payload.entry_type.toLowerCase()} recorded!`, 'success');
                closeModal('modal-partner');
                loadPartners();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }
}

async function loadCategories() {
    try {
        const res = await Api.getCategories();
        currentCategories = res.data;
        const filterSelect = document.getElementById('filter-expense-category');
        filterSelect.innerHTML =
            '<option value="All">All Categories</option>' +
            currentCategories.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');
    } catch (e) {
        console.error(e);
    }
}

async function loadProjectsDropdown() {
    try {
        const res = await Api.getProjects();
        currentProjects = res.data;
    } catch (e) {
        console.error(e);
    }
}

async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
        await Api.deleteProject(id);
        showToast('Project deleted.', 'success');
        loadProjects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
        await Api.deleteExpense(id);
        showToast('Expense record deleted.', 'success');
        loadExpenses();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function exportCsv(type) {
    window.location.href = `/api/reports/export-csv?type=${type}`;
}

function openExportExcelModal() {
    const modal = document.getElementById('modal-export-excel');
    if (!modal) return;
    
    // Set default upto date to today (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    const uptoInput = document.getElementById('export-excel-upto-date');
    if (uptoInput) {
        uptoInput.value = today;
    }
    const fromInput = document.getElementById('export-excel-from-date');
    if (fromInput) {
        fromInput.value = '';
    }
    
    openModal('modal-export-excel');
}

function closeExportExcelModal() {
    closeModal('modal-export-excel');
}

async function handleExportExcel(event) {
    if (event) event.preventDefault();
    const uptoInput = document.getElementById('export-excel-upto-date');
    const uptoDate = uptoInput ? uptoInput.value : '';
    const fromInput = document.getElementById('export-excel-from-date');
    const fromDate = fromInput ? fromInput.value : '';

    if (!uptoDate) {
        showToast('Please select a date up to which you need the data.', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-export-excel');
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> Generating Excel...';
    }

    try {
        const token = Api.getToken();
        let url = `/api/reports/export-excel?upto_date=${encodeURIComponent(uptoDate)}`;
        if (fromDate) {
            url += `&from_date=${encodeURIComponent(fromDate)}`;
        }
        if (token) {
            url += `&token=${encodeURIComponent(token)}`;
        }

        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(url, { headers });

        if (!response.ok) {
            let errorMsg = `Server returned status ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.message) errorMsg = errData.message;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = `Duolink_Financial_Report_Upto_${uptoDate}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();

        showToast('Excel report downloaded successfully!', 'success');
        closeModal('modal-export-excel');
    } catch (err) {
        console.error('Excel Export Error:', err);
        showToast('Export failed: ' + err.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

function quickFill(email, pw) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = pw;
}

function logout() {
    Api.clearSession();
    showToast('Signed out.', 'success');
    window.location.reload();
}

function formatCurrency(val) {
    const num = parseFloat(val || 0);
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// ==========================================
// PARTNER MODULE (R, V, D)
// ==========================================
let currentPartnerFilter = 'all';

async function loadPartners() {
    updateQuickSplitCalc();
    await Promise.all([loadPartnerSummary(), loadPartnerTransactions()]);
}

async function loadPartnerSummary() {
    try {
        const res = await Api.getPartnerSummary();
        const d = res.data;

        // Combined Partnership
        const combInc = document.getElementById('partner-comb-income');
        const combExp = document.getElementById('partner-comb-expense');
        const combNet = document.getElementById('partner-comb-net');
        if (combInc) combInc.textContent = formatCurrency(d.combined.total_income);
        if (combExp) combExp.textContent = formatCurrency(d.combined.total_expense);
        if (combNet) {
            combNet.textContent = formatCurrency(d.combined.net_balance);
            combNet.style.color = d.combined.net_balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        }

        // Partner R
        const rInc = document.getElementById('partner-r-income');
        const rExp = document.getElementById('partner-r-expense');
        const rNet = document.getElementById('partner-r-net');
        if (rInc) rInc.textContent = formatCurrency(d.partners.R.total_income);
        if (rExp) rExp.textContent = formatCurrency(d.partners.R.total_expense);
        if (rNet) {
            rNet.textContent = formatCurrency(d.partners.R.net_balance);
            rNet.style.color = d.partners.R.net_balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        }

        // Partner V
        const vInc = document.getElementById('partner-v-income');
        const vExp = document.getElementById('partner-v-expense');
        const vNet = document.getElementById('partner-v-net');
        if (vInc) vInc.textContent = formatCurrency(d.partners.V.total_income);
        if (vExp) vExp.textContent = formatCurrency(d.partners.V.total_expense);
        if (vNet) {
            vNet.textContent = formatCurrency(d.partners.V.net_balance);
            vNet.style.color = d.partners.V.net_balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        }

        // Partner D
        const dInc = document.getElementById('partner-d-income');
        const dExp = document.getElementById('partner-d-expense');
        const dNet = document.getElementById('partner-d-net');
        if (dInc) dInc.textContent = formatCurrency(d.partners.D.total_income);
        if (dExp) dExp.textContent = formatCurrency(d.partners.D.total_expense);
        if (dNet) {
            dNet.textContent = formatCurrency(d.partners.D.net_balance);
            dNet.style.color = d.partners.D.net_balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        }

        // Dynamic ordering: D first when D logs in, after that R and V!
        arrangePartnerCards();

        // Render Spotlight on Dashboard as well
        renderDashboardPartnerSpotlight(d);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function arrangePartnerCards() {
    const partnerCode = getActivePartnerCode();
    const container = document.getElementById('partner-cards-grid');
    if (!container) return;

    const cardD = document.getElementById('card-partner-d');
    const cardR = document.getElementById('card-partner-r');
    const cardV = document.getElementById('card-partner-v');
    const cardComb = document.getElementById('card-partner-comb');

    if (!cardD || !cardR || !cardV || !cardComb) return;

    const badgeD = document.getElementById('badge-partner-d');
    const badgeR = document.getElementById('badge-partner-r');
    const badgeV = document.getElementById('badge-partner-v');

    if (badgeD) {
        badgeD.textContent = partnerCode === 'D' ? '⭐ Partner D (You)' : 'Partner D';
        badgeD.style.fontWeight = partnerCode === 'D' ? '800' : '700';
    }
    if (badgeR) {
        badgeR.textContent = partnerCode === 'R' ? '⭐ Partner R (You)' : 'Partner R';
        badgeR.style.fontWeight = partnerCode === 'R' ? '800' : '700';
    }
    if (badgeV) {
        badgeV.textContent = partnerCode === 'V' ? '⭐ Partner V (You)' : 'Partner V';
        badgeV.style.fontWeight = partnerCode === 'V' ? '800' : '700';
    }

    cardD.style.border = partnerCode === 'D' ? '2.5px solid #f59e0b' : '1px solid var(--border-color)';
    cardR.style.border = partnerCode === 'R' ? '2.5px solid #3b82f6' : '1px solid var(--border-color)';
    cardV.style.border = partnerCode === 'V' ? '2.5px solid #10b981' : '1px solid var(--border-color)';

    // Dynamic sequence: when D logs in, D first, after that R and V!
    if (partnerCode === 'D') {
        container.appendChild(cardD);
        container.appendChild(cardR);
        container.appendChild(cardV);
        container.appendChild(cardComb);
    } else if (partnerCode === 'R') {
        container.appendChild(cardR);
        container.appendChild(cardV);
        container.appendChild(cardD);
        container.appendChild(cardComb);
    } else if (partnerCode === 'V') {
        container.appendChild(cardV);
        container.appendChild(cardR);
        container.appendChild(cardD);
        container.appendChild(cardComb);
    }
}

function renderDashboardPartnerSpotlight(partnerData) {
    const container = document.getElementById('spotlight-cards-container');
    if (!container || !partnerData || !partnerData.partners) return;

    const partnerCode = getActivePartnerCode();
    const avatarEl = document.getElementById('spotlight-avatar');
    const roleBadgeEl = document.getElementById('spotlight-role-badge');
    const titleEl = document.getElementById('spotlight-title');

    if (avatarEl) {
        avatarEl.className = `partner-avatar ${partnerCode.toLowerCase()}`;
        avatarEl.textContent = partnerCode;
    }
    if (roleBadgeEl) {
        roleBadgeEl.textContent = `Logged In Account: Partner ${partnerCode} (Admin)`;
    }
    if (titleEl) {
        titleEl.textContent = `Partner ${partnerCode} Priority Financial Snapshot`;
    }

    // Determine partner ordering: when D logs in, D first, after that R and V!
    let order = ['D', 'R', 'V'];
    if (partnerCode === 'R') order = ['R', 'V', 'D'];
    if (partnerCode === 'V') order = ['V', 'R', 'D'];

    const partnerMeta = {
        D: { name: 'Partner D', color: '#d97706', bg: '#fef3c7', border: '#f59e0b' },
        R: { name: 'Partner R', color: '#6d28d9', bg: '#ede9fe', border: '#8b5cf6' },
        V: { name: 'Partner V', color: '#047857', bg: '#d1fae5', border: '#10b981' }
    };

    container.innerHTML = order.map((code, index) => {
        const p = partnerData.partners[code] || { total_income: 0, total_expense: 0, net_balance: 0 };
        const meta = partnerMeta[code];
        const isSelf = code === partnerCode;

        return `
            <div style="background: ${isSelf ? '#ffffff' : '#f8fafc'}; border: ${isSelf ? '2.5px solid ' + meta.border : '1px solid var(--border-color)'}; border-radius: 12px; padding: 14px 16px; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="partner-avatar ${code.toLowerCase()}" style="width: 24px; height: 24px; font-size: 11px;">${code}</span>
                        <span style="font-weight: 800; font-size: 13.5px; color: var(--primary-900);">${meta.name}</span>
                    </div>
                    <span class="badge" style="background: ${meta.bg}; color: ${meta.color}; font-size: 10.5px; font-weight: 800;">
                        ${isSelf ? '⭐ You (' + code + ')' : (index === 0 ? 'Priority' : 'Partner ' + code)}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
                    <span style="color: var(--text-secondary);">Income Share:</span>
                    <span style="font-weight: 700; color: var(--accent-green);">${formatCurrency(p.total_income)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary);">Expense Share:</span>
                    <span style="font-weight: 700; color: var(--accent-red);">${formatCurrency(p.total_expense)}</span>
                </div>
                <div style="padding-top: 6px; border-top: 1px dashed var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; font-weight: 700;">Net Balance:</span>
                    <span style="font-size: 15px; font-weight: 800; color: ${p.net_balance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
                        ${formatCurrency(p.net_balance)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

async function loadPartnerTransactions() {
    try {
        const params = {};
        if (currentPartnerFilter === 'split') params.split_type = 'Split';
        if (currentPartnerFilter === 'individual') params.split_type = 'Individual';
        if (['R', 'V', 'D'].includes(currentPartnerFilter)) params.partner = currentPartnerFilter;
        if (currentPartnerFilter === 'income') params.entry_type = 'Income';
        if (currentPartnerFilter === 'expense') params.entry_type = 'Expense';

        const res = await Api.getPartnerTransactions(params);
        const tbody = document.getElementById('table-partner-transactions');
        if (!tbody) return;

        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No partner transactions found matching filter.</td></tr>';
            return;
        }

        tbody.innerHTML = res.data
            .map((t) => {
                const isInc = t.entry_type === 'Income';
                const typeBadge = isInc
                    ? '<span class="badge badge-green">Income (+)</span>'
                    : '<span class="badge badge-red">Expense (−)</span>';

                let distBadge = '';
                if (t.split_type === 'Split') {
                    distBadge = '<span class="badge badge-blue">3-Way Split (÷3)</span>';
                } else {
                    distBadge = `<span class="badge" style="background:#EDE9FE; color:#6D28D9; font-weight:700;">Individual: Partner ${t.partner_name}</span>`;
                }

                const totalColor = isInc ? 'var(--accent-green)' : 'var(--accent-red)';

                return `
                <tr>
                    <td><b>${t.transaction_code}</b></td>
                    <td>${formatDate(t.transaction_date)}</td>
                    <td><b>${t.description}</b></td>
                    <td>${typeBadge}</td>
                    <td>${distBadge}</td>
                    <td style="color:${totalColor}; font-weight:700;">${formatCurrency(t.total_amount)}</td>
                    <td style="font-weight:600; color:${parseFloat(t.amount_r) > 0 ? (isInc ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-muted)'};">${formatCurrency(t.amount_r)}</td>
                    <td style="font-weight:600; color:${parseFloat(t.amount_v) > 0 ? (isInc ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-muted)'};">${formatCurrency(t.amount_v)}</td>
                    <td style="font-weight:600; color:${parseFloat(t.amount_d) > 0 ? (isInc ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--text-muted)'};">${formatCurrency(t.amount_d)}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" style="padding:2px 8px; font-size:11px;" onclick="deletePartnerTransaction(${t.id})">Delete</button>
                    </td>
                </tr>
            `;
            })
            .join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function setPartnerFilter(filter, btn) {
    currentPartnerFilter = filter;
    document.querySelectorAll('.filter-pill').forEach((el) => el.classList.remove('active'));
    if (btn) btn.classList.add('active');
    loadPartnerTransactions();
}

function updateQuickSplitCalc() {
    const input = document.getElementById('quick-split-input');
    const val = parseFloat(input ? input.value : 0) || 0;
    const r = Math.floor((val / 3) * 100) / 100;
    const v = Math.floor((val / 3) * 100) / 100;
    const d = Math.round((val - r - v) * 100) / 100;

    const elR = document.getElementById('calc-val-r');
    const elV = document.getElementById('calc-val-v');
    const elD = document.getElementById('calc-val-d');
    if (elR) elR.textContent = formatCurrency(r);
    if (elV) elV.textContent = formatCurrency(v);
    if (elD) elD.textContent = formatCurrency(d);
}

function openPartnerModal(defaultEntryType = 'Income', defaultSplitType = 'Split') {
    document.getElementById('form-partner').reset();
    document.getElementById('ptr-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('ptr-partner-name').value = 'R';
    
    setPartner4In1Mode(defaultEntryType, defaultSplitType);
    openModal('modal-partner');
}

function setPartner4In1Mode(entryType, splitType) {
    document.getElementById('ptr-entry-type').value = entryType;
    document.getElementById('ptr-split-type').value = splitType;

    // Highlight active card
    document.querySelectorAll('.partner-mode-card').forEach((el) => el.classList.remove('active'));
    const modeKey = `card-mode-${entryType.toLowerCase()}-${splitType.toLowerCase()}`;
    const activeCard = document.getElementById(modeKey);
    if (activeCard) activeCard.classList.add('active');

    // Show/hide individual partner dropdown
    const indGroup = document.getElementById('group-partner-individual');
    if (indGroup) {
        indGroup.style.display = splitType === 'Individual' ? 'block' : 'none';
    }

    // Update modal title
    const titleEl = document.getElementById('modal-partner-title');
    if (titleEl) {
        titleEl.textContent = 'Add Income & Expenses';
    }

    updatePartnerFormPreview();
}

function updatePartnerFormPreview() {
    const entryType = document.getElementById('ptr-entry-type').value;
    const splitType = document.getElementById('ptr-split-type').value;
    const partnerName = document.getElementById('ptr-partner-name').value;
    const amountVal = parseFloat(document.getElementById('ptr-amount').value || 0);
    const feedback = document.getElementById('partner-calc-feedback');
    const submitBtn = document.getElementById('btn-submit-partner');

    if (feedback) {
        if (entryType === 'Expense') {
            feedback.className = 'split-callout expense';
            if (submitBtn) submitBtn.className = 'btn btn-secondary';
        } else {
            feedback.className = 'split-callout';
            if (submitBtn) submitBtn.className = 'btn btn-primary';
        }

        if (submitBtn) {
            submitBtn.textContent = `Record ${splitType === 'Split' ? '3-Way Split' : 'Individual'} ${entryType}`;
        }

        if (amountVal <= 0) {
            feedback.innerHTML = `<b>💡 ${splitType === 'Split' ? '3-Way Equal Division' : 'Individual Allocation'}:</b> Enter an amount to preview the calculated shares.`;
            return;
        }

        if (splitType === 'Split') {
            const r = Math.floor((amountVal / 3) * 100) / 100;
            const v = Math.floor((amountVal / 3) * 100) / 100;
            const d = Math.round((amountVal - r - v) * 100) / 100;
            feedback.innerHTML = `
                <b>⚡ 3-Way Equal Division (${entryType}):</b> ${formatCurrency(amountVal)} ÷ 3 = <b>${formatCurrency(r)}</b> each<br>
                <span style="font-weight:700; margin-top:4px; display:inline-block;">
                    Partner R: ${formatCurrency(r)} &nbsp;|&nbsp;
                    Partner V: ${formatCurrency(v)} &nbsp;|&nbsp;
                    Partner D: ${formatCurrency(d)}
                </span>
            `;
        } else {
            feedback.innerHTML = `
                <b>👤 Individual ${entryType}:</b> 100% (${formatCurrency(amountVal)}) assigned directly to <b>Partner ${partnerName}</b>.
            `;
        }
    }
}

async function deletePartnerTransaction(id) {
    if (!confirm('Are you sure you want to delete this partner transaction?')) return;
    try {
        await Api.deletePartnerTransaction(id);
        showToast('Partner transaction deleted.', 'success');
        loadPartners();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
