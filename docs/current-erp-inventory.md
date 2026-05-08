# Current ERP Implementation Inventory and Parity Audit Baseline

Generated: 2026-05-08  
Scope: current Next.js LPG ERP implementation only. No runtime validation was required because this is a source inventory.

## 1. Navigation Inventory

| Sidebar section | Submenu | Route path | Page title |
|---|---|---|---|
| Dashboard | Dashboard | `/dashboard` | Dashboard |
| Master Data | Customers | `/masters/customers` | Customers |
| Master Data | Vendors | `/masters/vendors` | Vendors |
| Master Data | Items | `/masters/items` | Items |
| Master Data | Banks | `/banks` | Banks |
| Master Data | Chart of Accounts | `/accounting/chart-of-accounts` | Chart of Accounts |
| Master Data | Customer Cylinder Balance | `/customer-cylinder-balances` | Customer Cylinder Balance |
| Operations | Purchase Filled Cylinder | `/operations/purchase-filled-cylinder` | Purchase Filled Cylinder |
| Operations | Sale LPG | `/operations/sale-lpg` | Sale LPG |
| Operations | Complete Day Sale | `/operations/complete-day-sale` | Complete Day Sale |
| Operations | Cylinder Return | `/operations/cylinder-return` | Cylinder Return |
| Operations | Day Closing | `/operations/day-closing` | Day Closing |
| Operations | Reversals | `/operations/reversals` | Transaction Reversals |
| Payments | Cash Receipt | `/payments/cash-receipt` | Cash Receipt |
| Payments | Cash Payment | `/payments/cash-payment` | Cash Payment |
| Payments | Bank Receipt | `/payments/bank-receipt` | Bank Receipt |
| Payments | Bank Payment | `/payments/bank-payment` | Bank Payment |
| Payments | Security Receipt | `/payments/security-receipt` | Security Receipt |
| Reports | Stock Ledger | `/stock-ledger` | Stock Ledger |
| Reports | Vouchers | `/accounting/vouchers` | Voucher List |
| Reports | Audit Log | `/audit-log` | Audit Log |
| Reports | Operational Reports | `/reports` | Operational Reports |
| Settings | Roles & Permissions | `/settings/roles` | Roles & Permissions |

Additional implemented routes not directly listed as sidebar submenus:

| Route path | Page title | Purpose |
|---|---|---|
| `/` | n/a | Redirects to `/dashboard`. |
| `/login` | Login | Session login form. |
| `/company` | Company Setup | Setup route present under `(setup)`; not in current sidebar. |
| `/financial-years` | Financial Years | Setup route present under `(setup)`; not in current sidebar. |
| `/accounting/vouchers/[id]` | Voucher Detail | Voucher line detail view. |
| `/operations/purchase-filled-cylinder/print/[documentNo]` | Purchase Filled Cylinder Receipt | Printable transaction document. |
| `/operations/sale-lpg/print/[documentNo]` | Sale LPG Invoice | Printable transaction document. |
| `/operations/cylinder-return/print/[documentNo]` | Cylinder Return Receipt | Printable transaction document. |
| `/payments/cash-receipt/print/[documentNo]` | Cash Receipt Voucher | Printable transaction document. |
| `/payments/cash-payment/print/[documentNo]` | Cash Payment Voucher | Printable transaction document. |
| `/payments/bank-receipt/print/[documentNo]` | Bank Receipt Voucher | Printable transaction document. |
| `/payments/bank-payment/print/[documentNo]` | Bank Payment Voucher | Printable transaction document. |
| `/payments/security-receipt/print/[documentNo]` | Security Receipt Voucher | Printable transaction document. |
| `/reports/stock-summary` | Stock Summary | Report screen. |
| `/reports/customer-cylinder-balances` | Customer Cylinder Balance Report | Report screen. |
| `/reports/daily-activity` | Daily Activity Report | Report screen. |
| `/reports/customer-ledger` | Customer Ledger Report | Report screen. |
| `/reports/vendor-ledger` | Vendor Ledger Report | Report screen. |
| `/reports/cash-book` | Cash Book Report | Report screen. |
| `/reports/trial-balance` | Trial Balance | Report screen. |
| `/reports/profit-loss` | Profit & Loss | Report screen. |
| `/reports/balance-sheet` | Balance Sheet | Report screen. |

## 2. Screen Inventory

| Screen | Route | Purpose | Page type | Filters available | Actions available | Print support | CSV support | API endpoints used |
|---|---|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Placeholder operational KPI cards and sidebar guidance. | Dashboard | None | None | No | No | None |
| Login | `/login` | Authenticate user and create session cookie. | Form | None | Login | No | No | `POST /api/auth/login` |
| Customers | `/masters/customers` | Customer master records for sales, receipts, and cylinder accountability. | List + form | None; loads all rows via `?all=1`. | Create, edit, reset | No | No | `GET /api/customers?all=1`, `POST /api/customers`, `PUT /api/customers/[id]` |
| Vendors | `/masters/vendors` | Vendor master records for filled-cylinder purchases and payables. | List + form | None; loads all rows via `?all=1`. | Create, edit, reset | No | No | `GET /api/vendors?all=1`, `POST /api/vendors`, `PUT /api/vendors/[id]` |
| Items | `/masters/items` | LPG cylinder item list. | List + form | None; loads all rows via `?all=1`. | Create, edit with high-risk confirmation, reset | No | No | `GET /api/items?all=1`, `POST /api/items`, `PUT /api/items/[id]` |
| Banks | `/banks` | Bank accounts used by bank receipt/payment vouchers. | List + form | None; loads all rows via `?all=1`. | Create, edit with high-risk confirmation, reset | No | No | `GET /api/banks?all=1`, `POST /api/banks`, `PUT /api/banks/[id]` |
| Chart of Accounts | `/accounting/chart-of-accounts` | Account list used by vouchers and financial transactions. | List + form | None; loads all rows via `?all=1`. | Create, edit with high-risk confirmation, reset | No | No | `GET /api/chart-of-accounts?all=1`, `POST /api/chart-of-accounts`, `PUT /api/chart-of-accounts/[id]` |
| Customer Cylinder Balance | `/customer-cylinder-balances` | Customer/item filled outstanding, empty owed, security held, and last movement. | List page | None in UI | View only | No | No | `GET /api/customer-cylinder-balances` |
| Purchase Filled Cylinder | `/operations/purchase-filled-cylinder` | Receive filled cylinders from vendor; posts stock ledger, vendor payable voucher, vendor empty due, audit log. | Form page | Lookup selects for vendor and item | Post purchase, reset, open printable view after save | Yes, via print route after save | No | `GET /api/vendors`, `GET /api/items`, `POST /api/purchases/filled-cylinder` |
| Sale LPG | `/operations/sale-lpg` | Post single LPG sale; posts customer receivable voucher, filled stock OUT, customer cylinder balance, audit log. | Form page | Lookup selects for customer and item | Post sale, reset, open printable view after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/items`, `POST /api/sales/lpg` |
| Complete Day Sale | `/operations/complete-day-sale` | Batch-post multiple sale issues. | Form page | Lookup selects for customers and items | Add row, post complete day sale | No dedicated batch print | No | `GET /api/customers`, `GET /api/items`, `POST /api/sales/lpg/batch` |
| Cylinder Return | `/operations/cylinder-return` | Receive empty cylinders from customer; posts empty stock IN and customer cylinder balance decrement. | Form page | Lookup selects for customer and item | Post return, reset, open printable view after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/items`, `POST /api/returns/cylinder` |
| Day Closing | `/operations/day-closing` | View closing status, close day, and reopen latest/selected day through service controls. | Control form | Current status only | Close day, reopen/request reopen depending API payload | No | No | `GET /api/day-closing`, `POST /api/day-closing`, `POST /api/day-closing/reopen` |
| Transaction Reversals | `/operations/reversals` | Create compensating reversal by kind and document number. | Form page | Kind select | Create reversal request | No visible print link | No | `POST /api/reversals` |
| Cash Receipt | `/payments/cash-receipt` | Receive customer cash; posts balanced cash receipt voucher and audit log. | Form page | Customer lookup | Post cash receipt, reset, open printable view after save | Yes, via print route after save | No | `GET /api/customers`, `POST /api/payments/cash-receipt` |
| Cash Payment | `/payments/cash-payment` | Pay vendor by cash; posts balanced cash payment voucher and audit log. | Form page | Vendor lookup | Post cash payment, reset, open printable view after save | Yes, via print route after save | No | `GET /api/vendors`, `POST /api/payments/cash-payment` |
| Bank Receipt | `/payments/bank-receipt` | Receive customer payment into bank; posts balanced bank receipt voucher and audit log. | Form page | Customer and bank lookups | Post bank receipt, reset, open printable view after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/banks`, `POST /api/payments/bank-receipt` |
| Bank Payment | `/payments/bank-payment` | Pay vendor from bank; posts balanced bank payment voucher and audit log. | Form page | Vendor and bank lookups | Post bank payment, reset, open printable view after save | Yes, via print route after save | No | `GET /api/vendors`, `GET /api/banks`, `POST /api/payments/bank-payment` |
| Security Receipt | `/payments/security-receipt` | Receive cylinder security deposit; posts cash/bank receipt style voucher and updates customer cylinder security. | Form page | Customer, item, optional bank lookups | Post security receipt, reset, open printable view after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/items`, `GET /api/banks`, `POST /api/payments/security-receipt` |
| Stock Ledger | `/stock-ledger` | Immutable filled/empty cylinder movements by item, date, source document. | List page | Item, from date, to date | Apply filters | No | No | `GET /api/items`, `GET /api/stock-ledger` |
| Voucher List | `/accounting/vouchers` | Accounting vouchers created by operational transactions. | List page | None | Open voucher detail | No | No | `GET /api/accounting/vouchers` |
| Voucher Detail | `/accounting/vouchers/[id]` | Voucher lines for one accounting voucher. | Detail list | Voucher id from route | View only | No | No | `GET /api/accounting/vouchers/[id]` |
| Audit Log | `/audit-log` | Review operational changes with before/after summaries. | List page | Module, action, user id, from date, to date | Filter | No | No | `GET /api/audit-logs` |
| Operational Reports | `/reports` | Report index cards. | Navigation list | None | Open report | No | No | None |
| Roles & Permissions | `/settings/roles` | Manage roles, permission assignments, and user assignments. | List + form | None | Create role, update role, reset, view/edit | No | No | `GET /api/rbac/roles`, `GET /api/rbac/permissions`, `POST /api/rbac/roles`, `PUT /api/rbac/roles/[id]` |
| Printable Transaction Document | `/operations/*/print/[documentNo]`, `/payments/*/print/[documentNo]` | Generic printable document for transaction stock entries and voucher lines. | Print page | Document type and number from route | Print | Yes | No | `GET /api/transaction-documents/[documentType]/[documentNo]` |

## 3. Transaction Modules Implemented

| Module | Status | Current implementation |
|---|---|---|
| Purchases | Partial | `Purchase Filled Cylinder` is implemented. It posts filled stock IN, vendor payable voucher, GST receivable when supplied, vendor empty return balance increment, document number, closed-day guard, RBAC, and audit log. Legacy purchase empty, purchase other, purchase returns, multi-line GIRN, empty return inside purchase, and 11.8kg global price behavior are missing. |
| Sales | Partial | Single `Sale LPG` and simplified `Complete Day Sale` batch are implemented. They post filled stock OUT, sales/receivable voucher, GST payable, optional security liability, customer empty owed/security, document numbers, closed-day guard, RBAC, and audit log. Legacy same-sale empty return, multi-line sale, direct/cash/credit payment type, invoice language, inline stock checks, and sale list/history are missing. |
| Returns | Partial | Customer `Cylinder Return` is implemented for empty returns only, with empty stock IN and customer empty owed decrement. Filled sale returns, purchase returns, return valuation, and approval workflow are missing. |
| Decanting | Missing | No route, schema entity, service, API endpoint, stock source type, report, or UI screen exists. |
| Cylinder conversion | Missing | No route, schema entity, service, API endpoint, stock source type, report, or UI screen exists. |
| Empty sale | Missing | No route, schema entity, service, API endpoint, stock source type, report, or UI screen exists. |
| Payments | Partial | Cash payment and bank payment to vendors are implemented as balanced vouchers with audit and closed-day guard. Expense payments, multi-line payments, account-to-account flexibility, and payment list/history are missing. |
| Receipts | Partial | Cash receipt, bank receipt, and security receipt are implemented as balanced vouchers. Multi-line receipt vouchers, receipt list/history, received amount integration inside complete-day sales, and security quantity capture are missing. |
| Reversals | Partial | Compensating reversals exist for sale, purchase, cash receipt, cash payment, bank receipt, bank payment, and cylinder return. They create reversal voucher/stock adjustment where applicable and write audit logs. There is no dedicated Reversal table, no reversal list/status screen, and the UI still describes the panel as a policy stub. |
| Day closing | Partial | Close day, sequential close enforcement, closed-day write blocking, reopen request, and reopen are implemented. UI exposes close/reopen basics. Cash reconciliation details, day close reports, approval queue, and historical close list are missing. |
| Opening balances | Partial | Schema and seed support opening stock via `StockSourceType.OPENING_BALANCE` and opening ledger rows are calculated in reports from prior voucher lines. There is no UI/API for shop opening balance, cash opening, customer opening balances, vendor opening balances, or locked one-time migration entry. |

## 4. Reports Inventory

All report screens use `ReportTableClient`, which supports date/as-of/select filters, `window.print()`, and CSV downloads when the endpoint supports `format=csv`.

| Report | Route | Filters | CSV support | Print support | Status |
|---|---|---|---|---|---|
| Operational Reports index | `/reports` | None | No | No | Complete as index only |
| Stock Summary | `/reports/stock-summary` | Item, from date, to date | Yes, `/api/reports/stock-summary?format=csv` | Yes | Partial; summary by item from stock ledger only |
| Customer Cylinder Balance Report | `/reports/customer-cylinder-balances` | Customer, item, from date, to date | Yes, `/api/reports/customer-cylinder-balances?format=csv` | Yes | Partial; outstanding empty cylinders and last movement |
| Daily Activity Report | `/reports/daily-activity` | From date, to date | Yes, `/api/reports/daily-activity?format=csv` | Yes | Partial; count summary only, not full DAR layout |
| Customer Ledger Report | `/reports/customer-ledger` | Customer, from date, to date | Yes, `/api/reports/customer-ledger?format=csv` | Yes | Partial; requires customer selection and voucher-line ledger |
| Vendor Ledger Report | `/reports/vendor-ledger` | Vendor, from date, to date | Yes, `/api/reports/vendor-ledger?format=csv` | Yes | Partial; requires vendor selection and voucher-line ledger |
| Cash Book Report | `/reports/cash-book` | Cash/bank account, from date, to date | Yes, `/api/reports/cash-book?format=csv` | Yes | Partial; combines cash and selected bank movement; no separate bank book screen |
| Trial Balance | `/reports/trial-balance` | Account type, from date, to date | Yes, `/api/reports/trial-balance?format=csv` | Yes | Partial; account totals only |
| Profit & Loss | `/reports/profit-loss` | From date, to date | Yes, `/api/reports/profit-loss?format=csv` | Yes | Partial; revenue/expense voucher-line report |
| Balance Sheet | `/reports/balance-sheet` | As-of date | Yes, `/api/reports/balance-sheet?format=csv` | Yes | Partial; asset/liability/equity voucher-line report |
| Stock Ledger | `/stock-ledger` | Item, from date, to date | No | No | Partial; operational ledger screen, not under report index |
| Audit Log | `/audit-log` | Module, action, user, from date, to date | No | No | Partial; control report only |
| Voucher List | `/accounting/vouchers` | None | No | No | Partial; accounting voucher list only |

Legacy/client reports not implemented as current report screens:

| Legacy/client report | Current status |
|---|---|
| Sale B/W Date with type/segment/item/brand/date and multiple output modes | Missing |
| Cylinder Conversion B/W Date | Missing |
| One Customer Sale History | Missing |
| Vendor Wise Receiving Report | Missing |
| General Ledger for arbitrary account | Missing |
| Sale Return Report | Missing |
| Purchase Return Report | Missing |
| Customer Stock Ledger | Missing |
| Access Cylinders by Customers and Own Business | Partial via Customer Cylinder Balance and Stock Summary, but not parity |
| Salewise Profit | Missing |
| Month/year Profit Report layout | Partial via Profit & Loss, but not parity |
| Bank Book as separate report | Missing; cash book can select bank/cash account |

## 5. Accounting Inventory

| Accounting area | Status | Notes |
|---|---|---|
| Chart of accounts | Partial | CRUD screen exists for code, name, account type, normal balance, status. Schema supports parent tree, level, control/system flags. UI does not expose parent, level, hierarchy view, or account search. |
| Vouchers | Partial | Operational services create balanced vouchers for sales, purchases, payments, security receipts, and reversals. Voucher list/detail are read-only. No manual journal voucher creation screen exists. |
| Ledgers | Partial | Customer, vendor, and cash/bank ledger reports exist with opening row calculation from prior voucher lines. No arbitrary general ledger screen exists. |
| Trial balance | Partial | Service-backed report with account type filter, print, CSV. |
| Profit/loss | Partial | Service-backed report from revenue and expense voucher lines, print, CSV. |
| Balance sheet | Partial | Service-backed report from assets, liabilities, equity with balance difference, print, CSV. |
| Bank book | Partial | No dedicated bank book route; cash book report can select a bank account. |
| Cash book | Partial | Service-backed cash/bank account movement report with opening/running balance, print, CSV. |
| Journal support | Partial | Voucher type `JV` exists and operational purchases/reversals use it. No manual journal voucher UI/API exists. |

## 6. Operational Controls

| Control | Status | Current behavior |
|---|---|---|
| RBAC | Partial/strong foundation | Permissions are module/action based, seeded for many modules, enforced in services/API for major writes and reports. Sidebar hides links based on permissions. Role management UI can assign permissions/users and protects last admin access. Some read/list API routes use request context but not all enforce explicit module permissions. |
| Audit logs | Partial | Services write audit logs for master data, transactions, roles, day closing, and reversals. Audit log viewer supports filters. Login/logout audit entries are not visibly written in current auth routes. |
| Day close | Partial | DayClosing model and service support status, sequential closing, cash balance, notes, and audit trail. Writes use `assertWritableBusinessDate`. |
| Reopen | Partial | Reopen request and direct reopen exist via API/service with audit trail and permission `day-closing.reopen:APPROVE`. UI exposes a basic reopen action but not a full approval queue. |
| Reversals | Partial | Compensating reversal logic exists; unsafe delete is explicitly blocked. No dedicated reversal table/list/status lifecycle exists. |
| Session/auth | Partial | Cookie-backed 12-hour session, login/logout endpoints, protected layout redirect, active-user and financial-year context. No password reset, user management UI, 2FA, session list, or login audit visible. |

## 7. UI Structure

| Area | Current pattern |
|---|---|
| Sidebar layout | `AppShell` renders a fixed-width left sidebar on desktop (`md:w-72`) and main content area. Sidebar groups are RBAC-filtered, show the LPG ERP brand block, section labels, text links, and logout button. |
| Dashboard layout | Placeholder KPI card grid with seven operational cards and a simple guidance panel. No live dashboard API is wired. |
| Form patterns | `OperationForm` provides page header, API error, success message, lookup selects, text/number/date/checkbox inputs, reset, submit, and optional printable link after save. `MasterDataManager` provides side-by-side form plus table for CRUD-like master data. |
| Table patterns | `DataTable` is a simple horizontal-scroll table with loading and empty states. Numeric-like columns are right-aligned by label heuristics. No pagination, sort, column search, or density controls. |
| Print layout pattern | Printable transactions and reports use `data-print-hidden`, `data-print-only`, `window.print()`, and regular HTML tables. Transaction print pages load generic voucher and stock data from `/api/transaction-documents/...`. |

## 8. Known Gaps

### Missing modules compared to legacy/client ERP

- Company Information management screen is not in active sidebar.
- User Management screen is missing; roles exist, but user CRUD and area assignment are absent.
- Cities, Areas, Brands, Categories, Expense Types, Item Prices, and Customer/Vendor opening balance screens are missing.
- Shop Opening Balance, Cash Opening, Customer Opening Balance, Vendor Opening Balance workflows are missing.
- Purchase Empty Cylinder, Purchase Other, Purchase Return Cylinder, and Purchase Return Other are missing.
- Decanting Sale, Cylinder Conversion, and Empty Sale are missing.
- Manual Journal Voucher creation is missing.
- Database Backup screen is missing.
- Bank coding is simplified to bank name/status only.

### Placeholder screens and routes

- Dashboard cards are placeholders (`--`) and do not call a dashboard API.
- `GET /api/health`, `GET /api/setup/status`, and `GET /api/accounting/chart-of-accounts` return placeholder status responses.
- Setup routes exist for company and financial years, but are outside current sidebar and were not observed as complete parity screens in the current source inventory.

### Partial workflows

- Purchase Filled Cylinder is single-line and lacks same-transaction empty return, global 11.8kg pricing, remarks, GST percent, and multi-line GIRN behavior.
- Sale LPG is single-line and lacks same-sale empty return, sale type, remarks, invoice language, customer outstanding inline display, stock availability display, multi-line invoice, and list/history screens.
- Complete Day Sale is simplified; it posts multiple rows but lacks legacy cash/credit payment type, amount received, per-row multi-item support, shared date/remarks, and automatic cash receipt for cash rows.
- Cylinder Return handles empty returns only; filled returns and valued sale returns are missing.
- Payments/receipts are single-party/single-line and do not support expense-account payments or multi-line vouchers.
- Reversals are functional compensating entries but lack a durable reversal table and workflow/status UI.
- Reports have generic table/CSV/print support but do not match many legacy report-specific filters and layouts.

### Missing reports

- Sale B/W Date, one-customer sale history, customer stock ledger, vendor-wise receiving, sale return, purchase return, conversion report, salewise profit, access cylinders by own business, and arbitrary general ledger are missing.
- Bank Book is only indirectly covered by Cash Book account filtering.

### Workflow mismatches

- Legacy purchase and sale screens are multi-line LPG operational documents; current purchase/sale forms are mostly single-item documents.
- Legacy customer cylinder accountability includes simultaneous empty return during sale and vendor empty return during purchase; current implementation separates customer cylinder return and only increments vendor empty due during purchase.
- Legacy complete-day sale supports cash/credit workflows; current batch sale always creates sale vouchers and does not create immediate receipts.
- Legacy print language selection is absent.
- Legacy current-stock and sale-stat widgets are absent.
- Legacy area/user access controls are modeled but not surfaced in current operational UI.

## 9. Client ERP Parity Estimate

These estimates compare the current implementation against the legacy/client ERP described in the reverse-engineering notes. They are baseline estimates for planning, not measured test results.

| Parity area | Estimate | Rationale |
|---|---:|---|
| Functional parity | 35% | Core foundations exist for auth, RBAC, master data, filled purchase, sale, empty return, payments, stock ledger, vouchers, reports, day close, and reversals. Several legacy modules and detailed LPG workflows are absent. |
| Workflow parity | 25% | Current workflows are service-backed and safer, but many legacy operational shortcuts and multi-line document behaviors are not yet replicated. |
| Reporting parity | 40% | Nine service-backed reports plus stock/audit/voucher lists exist with CSV/print on report pages, but many legacy report types and report-specific filters are missing. |
| Navigation parity | 45% | Current sidebar covers the main foundation areas, but legacy Configuration, Sale/Purchase, Return, Payment/Receipt, Reports, and Backup menus have many missing or consolidated routes. |

## Baseline Summary

The current ERP is a solid service-backed rebuild foundation rather than a full client ERP clone. It has the right architectural direction: API routes call services, writes are centralized, stock movements are immutable, vouchers are balanced, RBAC is service-enforced on important flows, and day close/reversal controls exist. The largest parity gaps are operational depth: multi-line LPG documents, opening balances, customer/vendor area workflows, purchase/sale returns, decanting/conversion/empty sale, manual journals, backup, detailed legacy reports, and dashboard live metrics.
