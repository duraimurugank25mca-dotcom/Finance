# Duolink Finance Application

A professional, secure, and responsive finance management system for managing company income, operational expenses, project accounts, advance payments, pending client receivables, and automated PDF invoice generation.

---

## 🏛️ Architecture Overview

```
Duolink Finance/
├── backend/                  # Node.js + Express.js REST API & PostgreSQL Engine
│   ├── src/
│   │   ├── config/db.js      # Dual-mode PostgreSQL connection (PGlite embedded WASM + pg.Pool native)
│   │   ├── controllers/      # Auth, Projects, Expenses, Income, Invoices, Reports, Users, Attachments
│   │   ├── middleware/       # JWT Auth, Role-Based Access Control (Admin/User), Multer uploads
│   │   ├── migrations/       # 001_initial_schema.sql (NUMERIC precision, FKs, indexes) & seed.js
│   │   ├── services/         # PDFKit professional invoice builder & audit logging
│   │   └── server.js         # HTTP entrypoint & database bootstrap
│   ├── tests/e2e_test.js     # 11-step automated verification test suite
│   └── uploads/              # Storage repository for receipts and payment proofs
│
├── frontend_web/             # Live Interactive Finance Portal (Modern Blue-and-White Theme)
│   ├── index.html            # Single-page dashboard containing all 13 application screens
│   ├── css/style.css         # Glassmorphism, card grids, financial badges, responsive navigation
│   └── js/                   # API client, state management, modal controllers, and CSV export
│
├── frontend_flutter/         # Flutter (Dart) Mobile Application for Android
│   ├── lib/                  # Theme, REST API client, Models, Login and Dashboard screens
│   ├── pubspec.yaml          # Flutter dependencies (http, intl, shared_preferences, url_launcher)
│   └── android/              # AndroidManifest.xml configured with network & storage permissions
│
├── docker-compose.yml        # PostgreSQL 16 Alpine container definition
└── README.md
```

---

## 👥 Role-Based Access Control (RBAC)

The application enforces **strictly two login roles**:

| Feature / Module | 👑 Admin | 👤 User |
| :--- | :---: | :---: |
| **Login Authentication** | Secure Email / Password | Secure Email / Password |
| **Company Totals & Balance** | Full Company-wide Visibility | Restricted to Permitted Records |
| **Project Management** | Create, View, Edit, Delete All | View Assigned Projects Only |
| **Assign Users to Projects** | Full Control | No Access |
| **Expense Management** | View All, Approve, Edit, Delete | View Assigned / Own, Register |
| **Receipt / Proof Upload** | Full Access | Full Access for Authorized Records |
| **Duolink Bill / Invoice PDF** | Generate, View, Download All | View/Download Authorized Invoices |
| **Record Payments & Advances** | Full Control | Permitted Projects Only |
| **Financial Reports & Analytics** | Company P&L, Monthly Reports, CSV | Restricted |
| **User Account Management** | Create Users, Set Permissions | **Access Denied (403 Forbidden)** |

### Default Test Credentials:
* **Admin Account:** `admin@duolink.com` / `Admin@123`
* **User Account:** `user@duolink.com` / `User@123`
* **Secondary User:** `sarah.finance@duolink.com` / `Sarah@123`

---

## 📊 Financial Calculations & Accounting Rules

1. **Company Available Balance:**
   $$\text{Company Balance} = \text{Total Income} - \text{Total Expenses}$$
2. **Project Profit / Margin:**
   $$\text{Project Profit} = \text{Total Project Income Received} - \text{Total Project Expenses}$$
3. **Pending Client Payments:**
   $$\text{Pending Payment} = (\text{Total Invoiced Amount} - \text{Advance Deduction}) - \text{Payments Received}$$
4. **Double-Counting Prevention:**
   * Contract amounts are contractual expectations and are **not** counted in cash income until received.
   * Advances are recorded once in `income_transactions` (flagged `is_advance = true`).
   * When an invoice payment is settled, the payment updates the invoice status without duplicating advance amounts.

---

## 🗄️ PostgreSQL Database Design

The schema uses strict financial precision (`NUMERIC(15, 2)`):
* `users`: Auth credentials, bcrypt hashes, permissions (`can_create_project`, `can_edit_records`, `can_delete_records`).
* `projects`: Project code (`PRJ-xxx`), contract amounts, advance balances, client contact info.
* `project_members`: Project assignment table for users with fine-grained capability flags.
* `expense_categories`: Salary, Travel, Fuel, Office Expenses, Software & Subscriptions, Hardware, Marketing, Maintenance, Other.
* `expenses`: Code (`EXP-xxx`), amount, date, payment method, optional project linkage, receipts.
* `invoices`: Invoice number (`DL-INV-YYYY-xxxx`), total amount, advance deduction, payment terms, status.
* `invoice_items`: Description, quantity, unit price, total line item amount.
* `income_transactions`: Code (`INC-xxx`), client, amount, advance flag, project linkage, transaction reference.
* `payments`: Itemized payments against issued invoices.
* `attachments`: Supporting receipts, payment proofs, vouchers with file metadata.
* `audit_logs`: Immutable audit trail of every financial mutation.

---

## 🚀 Quick Start Guide

### 1. Running the Backend & Interactive Portal

The backend includes a zero-config persistent PostgreSQL engine ready out of the box, and can connect to native PostgreSQL or Docker:

```powershell
# Navigate to backend
cd backend

# Install dependencies
npm install

# Start the server (auto-runs migrations and seeds initial accounts)
npm start
```

* **Interactive Web Portal:** [http://localhost:5000/](http://localhost:5000/)
* **REST API Root:** [http://localhost:5000/api](http://localhost:5000/api)
* **Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 2. Using Native PostgreSQL or Docker (Optional)

To connect to an external PostgreSQL service instead of the embedded engine:
1. Start PostgreSQL locally or with Docker:
   ```bash
   docker compose up -d
   ```
2. In `backend/.env`, set:
   ```env
   USE_POSTGRES=true
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/duolink_finance
   ```
3. Restart the server.

### 3. Running Automated Tests

Run the 11-step end-to-end verification test suite:
```powershell
cd backend
node tests/e2e_test.js
```

---

## 📱 Flutter Android Application

The Flutter application code is located in `frontend_flutter/`:
* `lib/main.dart`: App bootstrap with `AppTheme`.
* `lib/theme/app_theme.dart`: Clean blue-and-white theme.
* `lib/models/models.dart`: Models for Users, Projects, Expenses, Invoices, and Dashboard.
* `lib/services/api_service.dart`: HTTP API client configured for Android Emulator (`http://10.0.2.2:5000/api`).
* `lib/screens/login_screen.dart`: Authentication screen with quick-fill demo buttons.
* `lib/screens/dashboard_screen.dart`: Financial summary cards and role-based navigation drawer.

To run on an Android device or emulator:
```bash
cd frontend_flutter
flutter pub get
flutter run
```

---

## 📸 Application Screenshots

| 1. Welcome Splash (3.5s Brand Transition) | 2. Secure Login Screen |
| :---: | :---: |
| ![Welcome Splash](screenshots/01_splash_welcome.png) | ![Login Screen](screenshots/02_login_screen.png) |

| 3. Executive Financial Dashboard | 4. Projects Contracts & Milestones |
| :---: | :---: |
| ![Executive Dashboard](screenshots/03_dashboard.png) | ![Projects](screenshots/04_projects.png) |

| 5. Expenses Management & Proofs | 6. Income Records & Project Types |
| :---: | :---: |
| ![Expenses](screenshots/05_expenses.png) | ![Income](screenshots/06_income.png) |

| 7. Invoices, Billing & Advance Deductions | 8. Partner Accounts (R, V, D) & 3-Way Split |
| :---: | :---: |
| ![Invoices](screenshots/07_invoices.png) | ![Partner Module](screenshots/08_partner_module.png) |

| 9. Partner 4-in-1 Process Modal | 10. Document Repository & Proofs |
| :---: | :---: |
| ![Partner Modal](screenshots/09_partner_modal_4in1.png) | ![Attachments](screenshots/10_attachments.png) |

| 11. Financial Reports & Analytics | 12. User Management (Admin RBAC) |
| :---: | :---: |
| ![Reports](screenshots/11_reports.png) | ![User Management](screenshots/12_users_management.png) |

| 13. Profile & Security Settings |
| :---: |
| ![Profile](screenshots/13_profile.png) |

---

## 📄 License
Duolink Finance &copy; 2026. All rights reserved.
