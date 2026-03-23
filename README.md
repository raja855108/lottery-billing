# 🎲 Lottery Billing System v3.0

Complete Vite + React billing app with **role-based login** (Admin / User).

## 🔐 Default Login
| Username | Password   | Role  |
|----------|------------|-------|
| `admin`  | `admin123` | Admin |

> Change the admin password immediately after first login via the profile menu.

## ✨ Features

### Auth & Users
- 🔐 Login page with session persistence (survives refresh)
- 👤 User profile menu (top-right) — change password, sign out
- 👥 **Admin only**: Manage Users panel — create / edit / deactivate / delete users
- 🔒 **Admin only**: Rate lock toggle (locks all rates for all users)
- 📊 **Admin only**: Reports show all users' bills
- 📋 **User**: Reports show only own bills

### Billing
- ✅ Seller & Stocker tabs, per-user data isolation
- 🧾 Live Running Bill — Subtotal → Old Due/Cut → Final Bill
- 📲 WhatsApp All — blast modal with individual/bulk send
- 💾 SQL-style localStorage DB with bill history
- 📄 PDF print per bill or full report
- 🧹 One Click Clean

## 🚀 Getting Started

```bash
npm install
npm run dev       # → http://localhost:5173
```

## 📦 Build & Deploy

```bash
npm run build
# Upload dist/ to https://app.netlify.com/drop
```

## 🔌 Connecting a Real Backend

All auth calls are in `src/auth/api.js`.  
Replace each function body with a `fetch()` call to your API.  
Keep the return shapes identical — the UI will work without any changes.

```
src/auth/
  api.js        ← ✅ swap these fetch() calls for your backend
  mockDB.js     ← ❌ delete this when you have a real DB
  AuthContext.jsx    ← no changes needed
  LoginPage.jsx      ← no changes needed
  AdminUserManager.jsx  ← no changes needed
  ChangePasswordModal.jsx  ← no changes needed
```

## 📁 Project Structure

```
src/
├── App.jsx                    # Main app + role-gated UI
├── DB.js                      # Per-user localStorage engine
├── utils.js                   # Calc, WA, PDF helpers
├── index.css / main.jsx
├── auth/
│   ├── api.js                 # Backend-ready API layer
│   ├── mockDB.js              # Mock user store (swap for real DB)
│   ├── AuthContext.jsx        # React auth context + provider
│   ├── LoginPage.jsx          # Login screen
│   ├── AdminUserManager.jsx   # Create/edit/delete users
│   └── ChangePasswordModal.jsx
└── components/
    ├── Modal.jsx
    ├── RunningBill.jsx
    ├── SellerCard.jsx
    ├── StockerCard.jsx
    ├── WABlastModal.jsx
    └── ReportPage.jsx
```

## 🗄️ DB Schema (localStorage)

| Key                  | Description                  |
|----------------------|------------------------------|
| `auth_users`         | All user accounts            |
| `auth_session`       | Active session token         |
| `db_sellers_{uid}`   | Seller cards per user        |
| `db_stockers_{uid}`  | Stocker cards per user       |
| `db_meta_{uid}`      | Tab/lock prefs per user      |
| `db_bills`           | All saved bills (userId tag) |
| `db_customers`       | Customer registry            |
