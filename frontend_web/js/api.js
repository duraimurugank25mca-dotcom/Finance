// Duolink Finance API Client
const API_BASE = window.location.origin + '/api';

const Api = {
    getToken() {
        return localStorage.getItem('duolink_token');
    },

    getUser() {
        try {
            return JSON.parse(localStorage.getItem('duolink_user')) || null;
        } catch (e) {
            return null;
        }
    },

    setSession(token, user) {
        localStorage.setItem('duolink_token', token);
        localStorage.setItem('duolink_user', JSON.stringify(user));
    },

    clearSession() {
        localStorage.removeItem('duolink_token');
        localStorage.removeItem('duolink_user');
    },

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = options.headers || {};

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Only set Content-Type if body is not FormData
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const res = await fetch(url, { ...options, headers });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                if (res.status === 401 && !endpoint.includes('/auth/login')) {
                    this.clearSession();
                    window.location.reload();
                }
                throw new Error(data.message || `Request failed with status ${res.status}`);
            }

            return data;
        } catch (err) {
            console.error(`API Error [${endpoint}]:`, err.message);
            throw err;
        }
    },

    // Auth
    login(email, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    },

    getProfile() {
        return this.request('/auth/profile');
    },

    changePassword(currentPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    },

    // Dashboard & Reports
    getDashboardSummary() {
        return this.request('/reports/dashboard-summary');
    },

    getFinancialReports(year) {
        return this.request(`/reports/financial-reports?year=${year || new Date().getFullYear()}`);
    },

    // Projects
    getProjects() {
        return this.request('/projects');
    },

    getProjectById(id) {
        return this.request(`/projects/${id}`);
    },

    createProject(payload) {
        return this.request('/projects', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    updateProject(id, payload) {
        return this.request(`/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },

    deleteProject(id) {
        return this.request(`/projects/${id}`, { method: 'DELETE' });
    },

    assignProjectMember(projectId, memberData) {
        return this.request(`/projects/${projectId}/members`, {
            method: 'POST',
            body: JSON.stringify(memberData),
        });
    },

    // Expenses
    getExpenses(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/expenses?${query}`);
    },

    getCategories() {
        return this.request('/expenses/categories');
    },

    createExpense(formData) {
        return this.request('/expenses', {
            method: 'POST',
            body: formData,
        });
    },

    deleteExpense(id) {
        return this.request(`/expenses/${id}`, { method: 'DELETE' });
    },

    // Income
    getIncome(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/income?${query}`);
    },

    recordIncome(formData) {
        return this.request('/income', {
            method: 'POST',
            body: formData,
        });
    },

    // Invoices
    getInvoices(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/invoices?${query}`);
    },

    getInvoiceById(id) {
        return this.request(`/invoices/${id}`);
    },

    createInvoice(payload) {
        return this.request('/invoices', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    recordInvoicePayment(invoiceId, formData) {
        return this.request(`/invoices/${invoiceId}/payments`, {
            method: 'POST',
            body: formData,
        });
    },

    // Users (Admin only)
    getUsers() {
        return this.request('/users');
    },

    createUser(payload) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    updateUser(id, payload) {
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },

    deleteUser(id) {
        return this.request(`/users/${id}`, { method: 'DELETE' });
    },

    // Attachments
    getAttachments(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/attachments?${query}`);
    },

    uploadAttachment(formData) {
        return this.request('/attachments', {
            method: 'POST',
            body: formData,
        });
    },

    // Partners (R, V, D)
    getPartnerSummary() {
        return this.request('/partners/summary');
    },

    getPartnerTransactions(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/partners/transactions?${query}`);
    },

    createPartnerTransaction(payload) {
        return this.request('/partners/transactions', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    deletePartnerTransaction(id) {
        return this.request(`/partners/transactions/${id}`, { method: 'DELETE' });
    },
};

