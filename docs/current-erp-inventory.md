# Current ERP Implementation Inventory and Parity Audit Baseline
Last reviewed: 2026-05-14 (refreshed after multi-line payment receipt voucher parity sprint)

Generated: 2026-05-14  
Scope: current Next.js LPG ERP implementation only. No runtime validation was required because this is a source inventory.

## 1. Navigation Inventory

The sidebar now uses a legacy-style multi-section structure matching the client ERP's menu groups. RBAC filters each link at render time.

| Sidebar section | Submenu | Route path | Page title |
|---|---|---|---|
| Dashboard | Dashboard | `/dashboard` | Dashboard |
| Configuration | Company Information | `/configuration/company-information` | Company Information |
| Configuration | User Management | `/configuration/user-management` | User Management |
| Configuration | Cities | `/configuration/cities` | Cities |
| Configuration | Area | `/configuration/area` | Area |
| Configuration | Brand Coding | `/configuration/brand-coding` | Brand Coding |
| Configuration | Category Coding | `/configuration/category-coding` | Category Coding |
| Configuration | Item Coding | `/masters/items` | Items |
| Configuration | Customer Coding | `/masters/customers` | Customers |
| Configuration | Vendor Coding | `/masters/vendors` | Vendors |
| Configuration | Shop Opening Balance | `/configuration/shop-opening-balance` | Shop Opening Balance |
| Configuration | Cash Opening | `/configuration/cash-opening` | Cash Opening |
| Configuration | Day Closing | `/operations/day-closing` | Day Closing |
| Configuration | Customer Opening Balance | `/configuration/customer-opening-balance` | Customer Opening Balance |
| Configuration | Vendor Opening Balance | `/configuration/vendor-opening-balance` | Vendor Opening Balance |
| Configuration | Expense Type Coding | `/configuration/expense-type-coding` | Expense Type Coding |
| Sale / Purchase | Purchase Filled Cylinder | `/operations/purchase-filled-cylinder` | Purchase Filled Cylinder |
| Sale / Purchase | Purchase Empty Cylinder | `/sale-purchase/purchase-empty-cylinder` | Purchase Empty Cylinder |
| Sale / Purchase | Purchase Other | `/sale-purchase/purchase-other` | Purchase Other |
| Sale / Purchase | Complete Day Sale | `/operations/complete-day-sale` | Complete Day Sale |
| Sale / Purchase | Sale LPG | `/operations/sale-lpg` | Sale LPG |
| Sale / Purchase | Decanting Sale | `/sale-purchase/decanting-sale` | Decanting Sale |
| Sale / Purchase | Cylinder Conversion | `/sale-purchase/cylinder-conversion` | Cylinder Conversion |
| Sale / Purchase | Empty Sale | `/sale-purchase/empty-sale` | Empty Sale |
| Returns | Cylinder Return | `/operations/cylinder-return` | Cylinder Return |
| Returns | Purchase Return Cylinder | `/returns/purchase-return-cylinder` | Purchase Return Cylinder |
| Returns | Purchase Return Other | `/returns/purchase-return-other` | Purchase Return Other |
| Payment / Receipt | Cash Payment | `/payments/cash-payment` | Cash Payment |
| Payment / Receipt | Cash Receipt | `/payments/cash-receipt` | Cash Receipt |
| Payment / Receipt | Security Receipt | `/payments/security-receipt` | Security Receipt |
| Payment / Receipt | Chart of Account | `/accounting/chart-of-accounts` | Chart of Accounts |
| Payment / Receipt | Journal Vouchers | `/payments/journal-vouchers` | Journal Vouchers |
| Payment / Receipt | Bank Payments / Receipt | `/payments/bank-payments-receipts` | Bank Payments / Receipt |
| Reports | Sale B/W Date | `/reports/sale-between-dates` | Sale B/W Date |
| Reports | Cylinder Conversion B/W Date | `/reports/cylinder-conversion-between-dates` | Cylinder Conversion B/W Date |
| Reports | One Customer Sale History | `/reports/one-customer-sale-history` | One Customer Sale History |
| Reports | Stock Report | `/reports/stock-summary` | Stock Summary |
| Reports | Cash Book | `/reports/cash-book` | Cash Book |
| Reports | Bank Book | `/reports/bank-book` | Bank Book |
| Reports | Vendor Wise Receiving | `/reports/vendor-wise-receiving` | Vendor Wise Receiving |
| Reports | General Ledger | `/reports/general-ledger` | General Ledger |
| Reports | Customer Ledger | `/reports/customer-ledger` | Customer Ledger |
| Reports | Sale Return Report | `/reports/sale-return` | Sale Return Report |
| Reports | Purchase Return Report | `/reports/purchase-return` | Purchase Return Report |
| Reports | Customer Stock Ledger | `/reports/customer-stock-ledger` | Customer Stock Ledger |
| Reports | Daily Activity Report | `/reports/daily-activity` | Daily Activity Report |
| Reports | Access Cylinders | `/reports/customer-cylinder-balances` | Customer Cylinder Balance |
| Reports | Salewise Profit | `/reports/salewise-profit` | Salewise Profit |
| Reports | Profit / Loss Report | `/reports/profit-loss` | Profit & Loss |
| Database | Database Backup | `/database-backup` | Database Backup |

Additional implemented routes not directly listed as sidebar submenus:

| Route path | Page title | Purpose |
|---|---|---|
| `/` | n/a | Redirects to `/dashboard`. |
| `/login` | Login | Session login form. |
| `/company` | Company Setup | Setup route present under `(setup)`; not in current sidebar. |
| `/financial-years` | Financial Years | Setup route present under `(setup)`; not in current sidebar. |
| `/accounting/vouchers/[id]` | Voucher Detail | Voucher line detail view. |
| `/configuration/user-management/[id]/map-area` | Map Area | Assign area access to a user. |
| `/payments/journal-vouchers/print/[documentNo]` | Journal Voucher Print | Printable journal voucher via `PrintableTransactionDocument`. |
| `/operations/purchase-filled-cylinder/print/[documentNo]` | Purchase Filled Cylinder Receipt | Printable transaction document. |
| `/operations/sale-lpg/print/[documentNo]` | Sale LPG Invoice | Printable transaction document. |
| `/operations/cylinder-return/print/[documentNo]` | Cylinder Return Receipt | Printable transaction document. |
| `/sale-purchase/purchase-empty-cylinder/print/[documentNo]` | Purchase Empty Cylinder Receipt | Printable transaction document. |
| `/sale-purchase/purchase-other/print/[documentNo]` | Purchase Other Receipt | Printable transaction document. |
| `/sale-purchase/cylinder-conversion/print/[documentNo]` | Cylinder Conversion Receipt | Printable transaction document. |
| `/sale-purchase/empty-sale/print/[documentNo]` | Empty Sale Receipt | Printable transaction document. |
| `/sale-purchase/decanting-sale/print/[documentNo]` | Decanting Sale Receipt | Printable transaction document. |
| `/returns/purchase-return-cylinder/print/[documentNo]` | Purchase Return Cylinder Receipt | Printable transaction document. |
| `/returns/purchase-return-other/print/[documentNo]` | Purchase Return Other Receipt | Printable transaction document. |
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
| `/reports/bank-book` | Bank Book Report | Report screen. |
| `/reports/trial-balance` | Trial Balance | Report screen. |
| `/reports/profit-loss` | Profit & Loss | Report screen. |
| `/reports/balance-sheet` | Balance Sheet | Report screen. |
| `/stock-ledger` | Stock Ledger | Operational stock ledger. |
| `/audit-log` | Audit Log | Audit log viewer. |
| `/operations/reversals` | Transaction Reversals | Reversal entry form. |
| `/settings/roles` | Roles & Permissions | Role and permission management. |
| `/banks` | Banks | Bank account master. |
| `/customer-cylinder-balances` | Customer Cylinder Balance | Balance summary screen. |

## 2. Screen Inventory

| Screen | Route | Purpose | Page type | Filters available | Actions available | Print support | CSV support | API endpoints used |
|---|---|---|---|---|---|---|---|---|
| Dashboard | `/dashboard` | Live KPI tiles, bank position, current stock, sale stats, and quick links. API-backed. | Dashboard | None | Navigate via quick links | No | No | `GET /api/dashboard` |
| Login | `/login` | Authenticate user and create session cookie. | Form | None | Login | No | No | `POST /api/auth/login` |
| Customers | `/masters/customers` | Customer master records. | List + form | None; loads all rows via `?all=1`. | Create, edit, reset | No | No | `GET /api/customers?all=1`, `POST /api/customers`, `PUT /api/customers/[id]` |
| Vendors | `/masters/vendors` | Vendor master records. | List + form | None; loads all rows via `?all=1`. | Create, edit, reset | No | No | `GET /api/vendors?all=1`, `POST /api/vendors`, `PUT /api/vendors/[id]` |
| Items | `/masters/items` | LPG cylinder item list. | List + form | None; loads all rows via `?all=1`. | Create, edit with high-risk confirmation, reset | No | No | `GET /api/items?all=1`, `POST /api/items`, `PUT /api/items/[id]` |
| Banks | `/banks` | Bank accounts for bank receipt/payment vouchers. | List + form | None; loads all rows via `?all=1`. | Create, edit with high-risk confirmation, reset | No | No | `GET /api/banks?all=1`, `POST /api/banks`, `PUT /api/banks/[id]` |
| Chart of Accounts | `/accounting/chart-of-accounts` | Account list used by vouchers. | List + form | None; loads all rows via `?all=1`. | Create, edit with high-risk confirmation, reset | No | No | `GET /api/chart-of-accounts?all=1`, `POST /api/chart-of-accounts`, `PUT /api/chart-of-accounts/[id]` |
| Customer Cylinder Balance | `/customer-cylinder-balances` | Customer/item filled outstanding, empty owed, security held, last movement. | List page | None in UI | View only | No | No | `GET /api/customer-cylinder-balances` |
| Company Information | `/configuration/company-information` | Edit company name, address, NTN, and contact details. | Form | None | Save | No | No | `GET /api/configuration/company-information`, `PUT /api/configuration/company-information` |
| User Management | `/configuration/user-management` | User CRUD, role assignment, and password reset. | List + form | None | Create user, edit user, assign roles, reset password, navigate to Map Area | No | No | `GET /api/configuration/user-management`, `POST /api/configuration/user-management`, `PUT /api/configuration/user-management/[id]`, `POST /api/configuration/user-management/[id]/reset-password` |
| Map Area | `/configuration/user-management/[id]/map-area` | Assign area-level access to a user. | Form | User id from route | Save area mapping | No | No | `GET /api/configuration/user-management/[id]/map-area`, `PUT /api/configuration/user-management/[id]/map-area` |
| Cities | `/configuration/cities` | City master records. | List + form | None | Create, edit | No | No | `GET /api/configuration/cities`, `POST /api/configuration/cities`, `PUT /api/configuration/cities/[id]` |
| Area | `/configuration/area` | Area master records. | List + form | None | Create, edit | No | No | `GET /api/configuration/area`, `POST /api/configuration/area`, `PUT /api/configuration/area/[id]` |
| Brand Coding | `/configuration/brand-coding` | Brand master records. | List + form | None | Create, edit | No | No | `GET /api/configuration/brand-coding`, `POST /api/configuration/brand-coding`, `PUT /api/configuration/brand-coding/[id]` |
| Category Coding | `/configuration/category-coding` | Category master records. | List + form | None | Create, edit | No | No | `GET /api/configuration/category-coding`, `POST /api/configuration/category-coding`, `PUT /api/configuration/category-coding/[id]` |
| Expense Type Coding | `/configuration/expense-type-coding` | Expense type master records. | List + form | None | Create, edit | No | No | `GET /api/configuration/expense-type-coding`, `POST /api/configuration/expense-type-coding`, `PUT /api/configuration/expense-type-coding/[id]` |
| Shop Opening Balance | `/configuration/shop-opening-balance` | Set opening stock per item and cylinder state. Supports create, edit, and delete. | List + form | None | Create entry, edit entry, delete entry | No | No | `GET /api/configuration/shop-opening-balance`, `POST /api/configuration/shop-opening-balance`, `PUT /api/configuration/shop-opening-balance/[id]` |
| Cash Opening | `/configuration/cash-opening` | Set opening cash balance entries. | List + form | None | Create entry, edit entry | No | No | `GET /api/configuration/cash-opening`, `POST /api/configuration/cash-opening`, `PUT /api/configuration/cash-opening/[id]` |
| Customer Opening Balance | `/configuration/customer-opening-balance` | Set customer opening receivable balances. | List + form | None | Create entry, edit entry, delete (if unlocked) | No | No | `GET /api/configuration/customer-opening-balance`, `POST /api/configuration/customer-opening-balance`, `PUT /api/configuration/customer-opening-balance/[id]`, `DELETE /api/configuration/customer-opening-balance/[id]` |
| Vendor Opening Balance | `/configuration/vendor-opening-balance` | Set vendor opening payable/receivable balances. Locked after later transactions exist. | List + form | None | Create entry, edit entry (if unlocked), delete (if unlocked) | No | No | `GET /api/configuration/vendor-opening-balance`, `POST /api/configuration/vendor-opening-balance`, `PUT /api/configuration/vendor-opening-balance/[id]`, `DELETE /api/configuration/vendor-opening-balance/[id]` |
| Purchase Filled Cylinder | `/operations/purchase-filled-cylinder` | Multi-line receive filled cylinders from vendor. Posts stock, payable voucher, GST, vendor empty due, audit log, document number per line. | Form page (multi-line) | Vendor lookup | Add line, remove line, post purchase, reset, print after save | Yes, via print route after save | No | `GET /api/vendors`, `GET /api/items`, `POST /api/purchases/filled-cylinder` |
| Purchase Empty Cylinder | `/sale-purchase/purchase-empty-cylinder` | Multi-line purchase of empty cylinders from vendor. Posts empty stock IN, vendor payable voucher, audit log. | Form page (multi-line) | Vendor and account lookups | Add line, remove line, post purchase, reset, print after save | Yes, via print route after save | No | `GET /api/vendors`, `GET /api/items`, `GET /api/chart-of-accounts`, `POST /api/purchases/empty-cylinder` |
| Purchase Other | `/sale-purchase/purchase-other` | Multi-line non-cylinder purchase from vendor. Posts expense voucher and audit log. | Form page (multi-line) | Vendor and account lookups | Add line, remove line, post purchase, reset, print after save | Yes, via print route after save | No | `GET /api/vendors`, `GET /api/chart-of-accounts`, `POST /api/purchases/other` |
| Sale LPG | `/operations/sale-lpg` | Multi-line LPG sale. Posts customer receivable voucher, filled stock OUT, optional per-line empty return, optional security deposit, GST, customer cylinder balance, audit log, document number. | Form page (multi-line) | Customer lookup | Add line, remove line, post sale, reset, print after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/items`, `POST /api/sales/lpg` |
| Complete Day Sale | `/operations/complete-day-sale` | Batch multiple customer sales in one document. Each row supports payment type (Cash/Credit), amount received, and up to 3 item slots. Posts sale vouchers and cash receipts where applicable. | Form page (multi-row, multi-item) | Customer lookups per row | Add row, remove row, post complete day sale, reset | No dedicated batch print | No | `GET /api/customers`, `GET /api/items`, `POST /api/sales/lpg/batch` |
| Cylinder Return | `/operations/cylinder-return` | Multi-line customer cylinder return. Supports both filled and empty return types. Empty returns decrement customer empty owed; filled returns create credit voucher. | Form page (multi-line) | Customer lookup | Add line, remove line, post return, reset, print after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/items`, `POST /api/returns/cylinder` |
| Purchase Return Cylinder | `/returns/purchase-return-cylinder` | Return filled/empty cylinders to vendor. Posts stock adjustment and credit/debit note voucher. | Form page (multi-line) | Vendor lookup | Add line, remove line, post return, reset, print after save | Yes, via print route after save | No | `GET /api/vendors`, `GET /api/items`, `POST /api/returns/purchase-return-cylinder` |
| Purchase Return Other | `/returns/purchase-return-other` | Return other purchase items to vendor. Posts expense reversal voucher. | Form page (multi-line) | Vendor and account lookups | Add line, remove line, post return, reset, print after save | Yes, via print route after save | No | `GET /api/vendors`, `GET /api/chart-of-accounts`, `POST /api/returns/purchase-return-other` |
| Cylinder Conversion | `/sale-purchase/cylinder-conversion` | Convert cylinders from one item/state to another. Posts stock OUT and stock IN adjustment, audit log, document number. | Form page | Item lookups | Post conversion, reset, print after save | Yes, via print route after save | No | `GET /api/items`, `POST /api/sale-purchase/cylinder-conversion` |
| Empty Sale | `/sale-purchase/empty-sale` | Multi-line sale of empty cylinders to customer. Posts empty stock OUT, customer receivable voucher, GST, audit log. | Form page (multi-line) | Customer lookup | Add line, remove line, post sale, reset, print after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/items`, `POST /api/sale-purchase/empty-sale` |
| Decanting Sale | `/sale-purchase/decanting-sale` | Decant/refill from a source cylinder and sell to customer. Posts source stock adjustment, sale voucher, customer receivable, GST, audit log. | Form page | Customer and item lookups | Post decanting sale, reset, print after save | Yes, via print route after save | No | `GET /api/customers`, `GET /api/items`, `POST /api/sale-purchase/decanting-sale` |
| Day Closing | `/operations/day-closing` | View closing status, close day, reopen latest/selected day. | Control form | Current status only | Close day, reopen depending on API payload | No | No | `GET /api/day-closing`, `POST /api/day-closing`, `POST /api/day-closing/reopen` |
| Transaction Reversals | `/operations/reversals` | Create compensating reversal by kind and document number. | Form page | Kind select | Create reversal | No | No | `POST /api/reversals` |
| Cash Receipt | `/payments/cash-receipt` | Receive cash. Multi-line mode: date, narration header; account selector per line with description and amount; auto-debits Cash for total; add/remove rows; balanced voucher, audit log, closed-day guard, RBAC. Simple (single-party) mode retained via tab toggle. | Form page (multi-line + simple tab) | Account selector (asset/liability/revenue), mode toggle | Add row, remove row, post, reset, print after save | Yes | No | `GET /api/chart-of-accounts`, `POST /api/payments/cash-receipt` |
| Cash Payment | `/payments/cash-payment` | Pay by cash. Multi-line mode: date, narration header; account selector per line (vendor, expense, or any asset/liability/expense account) with description and amount; auto-credits Cash for total; add/remove rows; balanced voucher, audit log, closed-day guard, RBAC. Simple (vendor-only) mode retained via tab toggle. | Form page (multi-line + simple tab) | Account selector (asset/liability/expense), mode toggle | Add row, remove row, post, reset, print after save | Yes | No | `GET /api/chart-of-accounts`, `POST /api/payments/cash-payment` |
| Bank Receipt | `/payments/bank-receipt` | Receive payment into bank. Multi-line mode: date, narration, bank selector header; account selector per line with description and amount; auto-debits selected Bank for total; add/remove rows; balanced voucher, audit log, closed-day guard, RBAC. Simple (customer-only) mode retained via tab toggle. | Form page (multi-line + simple tab) | Bank selector, account selector (asset/liability/revenue), mode toggle | Add row, remove row, post, reset, print after save | Yes | No | `GET /api/banks`, `GET /api/chart-of-accounts`, `POST /api/payments/bank-receipt` |
| Bank Payment | `/payments/bank-payment` | Pay from bank. Multi-line mode: date, narration, bank selector header; account selector per line (vendor, expense, or any asset/liability/expense account) with description and amount; auto-credits selected Bank for total; add/remove rows; balanced voucher, audit log, closed-day guard, RBAC. Simple (vendor-only) mode retained via tab toggle. | Form page (multi-line + simple tab) | Bank selector, account selector (asset/liability/expense), mode toggle | Add row, remove row, post, reset, print after save | Yes | No | `GET /api/banks`, `GET /api/chart-of-accounts`, `POST /api/payments/bank-payment` |
| Security Receipt | `/payments/security-receipt` | Receive cylinder security deposit. | Form page | Customer, item, optional bank lookups | Post, reset, print after save | Yes | No | `GET /api/customers`, `GET /api/items`, `GET /api/banks`, `POST /api/payments/security-receipt` |
| Bank Payments / Receipt | `/payments/bank-payments-receipts` | Unified screen for bank payment and receipt. Shows recent bank vouchers with date/type filters and action links to Bank Receipt and Bank Payment routes. | Unified list + action links | Date range, voucher type | Navigate to Bank Receipt, navigate to Bank Payment | No | No | `GET /api/accounting/vouchers?type=bank` |
| Journal Vouchers | `/payments/journal-vouchers` | Create manual balanced journal entries. Enforces balanced debit/credit, closed-day guard, RBAC, audit log, JV- document number. Table-style multi-line entry with add/remove rows and balance indicator. Lists existing manual JVs. | Form page (multi-line) + list | Account selector per line, date, narration | Add row, remove row, post journal voucher, print after save | Yes, via `/payments/journal-vouchers/print/[documentNo]` | No | `GET /api/accounting/journal-vouchers`, `POST /api/accounting/journal-vouchers`, `GET /api/chart-of-accounts` |
| Stock Ledger | `/stock-ledger` | Immutable filled/empty cylinder movements by item, date, source document. | List page | Item, from date, to date | Apply filters | No | No | `GET /api/items`, `GET /api/stock-ledger` |
| Voucher List | `/accounting/vouchers` | Accounting vouchers created by operational transactions. | List page | None | Open voucher detail | No | No | `GET /api/accounting/vouchers` |
| Voucher Detail | `/accounting/vouchers/[id]` | Voucher lines for one accounting voucher. | Detail list | Voucher id from route | View only | No | No | `GET /api/accounting/vouchers/[id]` |
| Audit Log | `/audit-log` | Review operational changes with before/after summaries. | List page | Module, action, user id, from date, to date | Filter | No | No | `GET /api/audit-logs` |
| Roles & Permissions | `/settings/roles` | Manage roles, permission assignments, and user assignments. | List + form | None | Create role, update role, view/edit | No | No | `GET /api/rbac/roles`, `GET /api/rbac/permissions`, `POST /api/rbac/roles`, `PUT /api/rbac/roles/[id]` |
| Database Backup | `/database-backup` | Trigger database backup, list existing backup files, download backups. | Control + list | None | Trigger backup, download file | No | No | `GET /api/database-backup`, `POST /api/database-backup`, `GET /api/database-backup/download/[filename]` |
| Printable Transaction Document | `/operations/*/print/[documentNo]`, `/payments/*/print/[documentNo]`, `/sale-purchase/*/print/[documentNo]`, `/returns/*/print/[documentNo]` | Generic printable document for transaction stock entries and voucher lines. | Print page | Document type and number from route | Print | Yes | No | `GET /api/transaction-documents/[documentType]/[documentNo]` |

## 3. Transaction Modules Implemented

| Module | Status | Current implementation |
|---|---|---|
| Purchases | Substantial | `Purchase Filled Cylinder` is multi-line: supports multiple line items, per-line cylinderState (FILLED/EMPTY), per-line GST percent, per-line empty return quantity, global 11.8kg price field, remarks, vendor lookup, document number, closed-day guard, RBAC, and audit log. `Purchase Empty Cylinder` and `Purchase Other` are implemented as multi-line forms with account selection and print support. |
| Sales | Substantial | `Sale LPG` is multi-line: supports multiple sale lines each with item, quantity, unit price, GST percent, security deposit amount, and per-line same-sale empty return. Posts filled stock OUT, customer receivable voucher, GST payable, empty stock IN per return line, customer cylinder balance, document numbers, closed-day guard, RBAC, and audit log. `Complete Day Sale` batch now supports per-row paymentType (Cash/Credit), amountReceived, and up to 3 item slots per row. `Decanting Sale` and `Empty Sale` are implemented. |
| Returns | Substantial | Customer `Cylinder Return` is multi-line and handles both filled and empty return types per line. Filled returns create a credit voucher; empty returns decrement customer empty owed. `Purchase Return Cylinder` and `Purchase Return Other` are implemented with multi-line support, stock adjustment, and credit/debit note vouchers. |
| Cylinder Conversion | Complete | Route, API endpoint, service, stock adjustment (OUT source + IN destination), document number, print support, audit log, and UI form are implemented. |
| Decanting Sale | Complete | Route, API endpoint, service, source stock decrement, customer sale voucher, GST, document number, print support, audit log, and UI form are implemented. |
| Empty Sale | Complete | Route, API endpoint, service, empty stock OUT, customer receivable voucher, GST, document number, multi-line, print support, audit log, and UI form are implemented. |
| Payments | Substantial | Cash payment and bank payment support both simple (single-vendor) and multi-line modes. Multi-line mode accepts any asset/liability/expense account per line; auto-credits the cash or bank account for the total. Expense-account payments are fully supported. Balanced voucher, RBAC, closed-day guard, audit log, and print on all paths. Payment list/history screen is missing. |
| Receipts | Substantial | Cash receipt, bank receipt, and security receipt all implemented. Cash and bank receipt now support multi-line mode: any asset/liability/revenue account per line; auto-debits the cash or bank account for the total. Balanced voucher, RBAC, closed-day guard, audit log, and print on all paths. Receipt list/history and security quantity capture are missing. |
| Reversals | Partial | Compensating reversals exist for sale, purchase, cash receipt, cash payment, bank receipt, bank payment, and cylinder return. No dedicated Reversal table, reversal list/status screen, or workflow lifecycle exists. |
| Day closing | Partial | Close day, sequential close enforcement, closed-day write blocking, reopen request, and reopen are implemented. Cash reconciliation details, day close reports, approval queue, and historical close list are missing. |
| Opening balances | Substantial | Shop Opening Balance, Cash Opening, Customer Opening Balance, and Vendor Opening Balance all have full UI and API screens with create, edit, delete, and transaction-lock guard. One-time migration lock is missing. |
| Manual Journal Vouchers | Complete | Full manual JV creation at `/payments/journal-vouchers`: table-style multi-line entry, balanced debit/credit enforcement, closed-day guard, RBAC (`journal-vouchers:CREATE/VIEW`), audit log, `JV-` document number, printable via `PrintableTransactionDocument`. Lists all manual JVs. |

## 4. Reports Inventory

All report screens use `ReportTableClient`, which supports date/as-of/select filters, `window.print()`, and CSV downloads when the endpoint supports `format=csv`.

| Report | Route | Filters | CSV support | Print support | Status |
|---|---|---|---|---|---|
| Sale B/W Date | `/reports/sale-between-dates` | Customer, item, from date, to date | Yes | Yes | Partial; tabular list of sale invoices; matches legacy Sale B/W Date layout |
| Cylinder Conversion B/W Date | `/reports/cylinder-conversion-between-dates` | Item, from date, to date | Yes | Yes | Partial; tabular list of conversion records |
| One Customer Sale History | `/reports/one-customer-sale-history` | Customer, item, from date, to date | Yes | Yes | Partial; same columns as Sale B/W Date filtered to one customer |
| Stock Summary | `/reports/stock-summary` | Item, from date, to date | Yes | Yes | Partial; summary by item from stock ledger |
| Cash Book | `/reports/cash-book` | Cash/bank account, from date, to date | Yes | Yes | Partial; cash and selected cash/bank account movement with opening and running balance |
| Bank Book | `/reports/bank-book` | Bank selector, from date, to date | Yes | Yes | Partial; bank account movement restricted to Bank records; opening balance, running balance, voucher reference, narration |
| Vendor Wise Receiving | `/reports/vendor-wise-receiving` | Vendor, item, from date, to date | Yes | Yes | Partial; filled/empty cylinder receipts from vendors |
| General Ledger | `/reports/general-ledger` | Account selector, from date, to date | Yes | Yes | Partial; arbitrary chart account selector; voucher-line ledger with opening balance, running balance, source document, narration |
| Customer Ledger | `/reports/customer-ledger` | Customer, from date, to date | Yes | Yes | Partial; requires customer selection; voucher-line ledger with opening balance and running balance |
| Sale Return Report | `/reports/sale-return` | Customer, item, from date, to date | Yes | Yes | Partial; cylinder return records from customers |
| Purchase Return Report | `/reports/purchase-return` | Vendor, item, from date, to date | Yes | Yes | Partial; cylinder and other purchase returns to vendors |
| Customer Stock Ledger | `/reports/customer-stock-ledger` | Customer, item, from date, to date | Yes | Yes | Partial; all cylinder movements for a customer |
| Daily Activity Report | `/reports/daily-activity` | From date, to date | Yes | Yes | Partial; count summary only, not full DAR layout |
| Access Cylinders | `/reports/customer-cylinder-balances` | Customer, item, from date, to date | Yes | Yes | Partial; outstanding empty cylinders and last movement |
| Salewise Profit | `/reports/salewise-profit` | Customer, item, from date, to date | Yes | Yes | Partial; per-sale-per-item rows with weighted-average cost approximation from financial-year purchase data; gross profit and profit % per row |
| Profit / Loss Report | `/reports/profit-loss` | From date, to date | Yes | Yes | Partial; revenue/expense voucher-line report |
| Vendor Ledger | `/reports/vendor-ledger` | Vendor, from date, to date | Yes | Yes | Partial; requires vendor selection; voucher-line ledger |
| Trial Balance | `/reports/trial-balance` | Account type, from date, to date | Yes | Yes | Partial; account totals only |
| Balance Sheet | `/reports/balance-sheet` | As-of date | Yes | Yes | Partial; asset/liability/equity voucher-line report |
| Stock Ledger | `/stock-ledger` | Item, from date, to date | No | No | Partial; operational ledger screen, not under report index |
| Audit Log | `/audit-log` | Module, action, user, from date, to date | No | No | Partial; control report only |
| Voucher List | `/accounting/vouchers` | None | No | No | Partial; accounting voucher list only |

Legacy/client reports remaining not implemented as full-parity screens:

| Legacy/client report | Current status |
|---|---|
| Month/year Profit Report layout | Partial via Profit & Loss, but not parity layout |
| Sale B/W Date — output modes (item-wise, amount-wise, type-wise) | Single flat table; multi-mode output not implemented |
| Daily Activity Report full layout | Count summary only; full DAR layout with section breakdowns missing |

## 5. Accounting Inventory

| Accounting area | Status | Notes |
|---|---|---|
| Chart of accounts | Partial | CRUD screen exists for code, name, account type, normal balance, status. Schema supports parent tree, level, control/system flags. UI does not expose parent, level, hierarchy view, or account search. |
| Vouchers | Substantial | Operational services create balanced vouchers for sales, purchases, returns, decanting, empty sale, cylinder conversion, payments, security receipts, and reversals. Voucher list/detail are read-only. Manual journal voucher creation screen now exists at `/payments/journal-vouchers`. |
| Ledgers | Substantial | Customer, vendor, cash/bank, general ledger (arbitrary account), and bank book reports exist with opening row calculation from prior voucher lines. All use the shared `accountLedger` engine. |
| Trial balance | Partial | Service-backed report with account type filter, print, CSV. |
| Profit/loss | Partial | Service-backed report from revenue and expense voucher lines, print, CSV. |
| Balance sheet | Partial | Service-backed report from assets, liabilities, equity with balance difference, print, CSV. |
| Bank book | Partial | Dedicated bank book report at `/reports/bank-book` with bank selector restricted to Bank records, opening balance, running balance, date filter, CSV, print. |
| Cash book | Partial | Service-backed cash/bank account movement report with opening/running balance, print, CSV. |
| Journal support | Substantial | Voucher type `JV` exists and operational purchases/reversals use it. Manual journal voucher UI/API now fully implemented at `/payments/journal-vouchers` with balanced enforcement, closed-day guard, RBAC, and audit log. |

## 6. Operational Controls

| Control | Status | Current behavior |
|---|---|---|
| RBAC | Partial/strong foundation | Permissions are module/action based, seeded for many modules, enforced in services/API for major writes and reports. Sidebar hides links based on permissions. Role management UI can assign permissions/users and protects last admin access. |
| Audit logs | Partial | Services write audit logs for master data, transactions, roles, day closing, reversals, and opening balances. Audit log viewer supports filters. Login/logout audit entries are not visibly written in current auth routes. |
| Day close | Partial | DayClosing model and service support status, sequential closing, cash balance, notes, and audit trail. Writes use `assertWritableBusinessDate`. |
| Reopen | Partial | Reopen request and direct reopen exist via API/service with audit trail and permission `day-closing.reopen:APPROVE`. UI exposes a basic reopen action but not a full approval queue. |
| Reversals | Partial | Compensating reversal logic exists for all major transaction kinds; unsafe delete is explicitly blocked. No dedicated reversal table/list/status lifecycle exists. |
| Session/auth | Partial | Cookie-backed 12-hour session, login/logout endpoints, protected layout redirect, active-user and financial-year context. No password reset self-service, 2FA, or session list exists. User Management screen provides admin-level password reset. |
| User management | Partial | Full user CRUD, role assignment, password reset (admin-initiated), status toggle, and Map Area assignment exist in the Configuration section. Self-service profile and password change are missing. |
| Opening balances | Substantial | Shop Opening Balance, Cash Opening, Customer Opening Balance, and Vendor Opening Balance UI/API screens all exist with create, edit, delete, locked status, and audit log. One-time migration lock is missing. |
| Database backup | Partial | Trigger backup, list backup files, and download existing backup files via UI. Restore from backup and scheduled/automated backup are missing. |

## 7. UI Structure

| Area | Current pattern |
|---|---|
| Sidebar layout | `AppShell` renders a fixed-width left sidebar on desktop (`md:w-72`) and main content area. Sidebar uses legacy-style multi-section groups (Configuration, Sale/Purchase, Returns, Payment/Receipt, Reports, Database) with RBAC filtering per link. |
| Dashboard layout | Live API-backed KPI tile grid, bank position table, current stock table, sale stats widget, and quick-links grid. Calls `GET /api/dashboard` on load. |
| Form patterns | `OperationForm` provides page header, API error, success message, lookup selects, text/number/date/checkbox inputs, reset, submit, and optional printable link after save. Multi-line forms (Purchase Filled Cylinder, Sale LPG, Cylinder Return, etc.) use internal line arrays with add/remove controls. `MasterDataManager` provides side-by-side form plus table for CRUD-like master data. |
| Table patterns | `DataTable` is a simple horizontal-scroll table with loading and empty states. Numeric-like columns are right-aligned by label heuristics. No pagination, sort, column search, or density controls. |
| Print layout pattern | Printable transactions and reports use `data-print-hidden`, `data-print-only`, `window.print()`, and regular HTML tables. Transaction print pages load generic voucher and stock data from `/api/transaction-documents/...`. |
| Report pattern | `ReportTableClient` is a shared client component with date/account/entity filter dropdowns, Apply Filters, CSV download, and Print actions. Used by all 19 report screens. Supports `showBankFilter` for bank-restricted selectors (bank book). |

## 8. Known Gaps

### Remaining missing or placeholder modules

- Financial Years and Company Setup routes exist under `(setup)` but are outside the sidebar and not user-accessible.
- Bank coding is simplified to bank name/status only; branch/account number fields are absent.
- One-time migration lock for opening balances is not enforced; users can add opening balances after live transactions exist (the per-record transaction-lock guard prevents editing, but not the initial entry).

### Partial workflows

- Purchase Filled Cylinder multi-line GIRN: global 11.8kg price field exists but per-line pricing still required for different cylinder sizes.
- Sale LPG: customer outstanding inline display and stock availability inline check are missing; sale type/invoice language selection is absent.
- Complete Day Sale: shared date and remarks per batch are supported; automatic cash receipt posting for Cash rows depends on service implementation.
- Cylinder Return: approval workflow for valued returns is missing.
- Payments/receipts list/history: no searchable history view for past cash/bank receipts and payments (voucher list at `/accounting/vouchers` is the only fallback).
- Reversals: functional compensating entries but no dedicated Reversal table, reversal list, or status lifecycle UI.
- Day closing: cash reconciliation details, day close reports, and historical close list are missing.
- Database backup: restore from backup and scheduled backup are missing.

### Missing reports

- Sale B/W Date multi-mode output (item-wise, amount-wise, type-wise, segment-wise).
- Daily Activity Report full layout (currently count-summary only).
- Month/year profit layout parity.

### Workflow mismatches

- Legacy print language selection is absent.
- Legacy area/user access controls are modeled in Map Area but not surfaced in per-transaction routing or RBAC filters.

## 9. Client ERP Parity Estimate

These estimates compare the current implementation against the legacy/client ERP described in the reverse-engineering notes. They are estimates for planning, not measured test results.

| Parity area | Estimate | Rationale |
|---|---:|---|
| Functional parity | 83% | All major transaction modules, full opening balance suite, manual journal vouchers, bank payments/receipt unified screen, and now multi-line payment/receipt vouchers with expense-account support are implemented. Remaining gaps are payment/receipt list-history screens, reversal lifecycle UI, and day-close reconciliation workflow. |
| Workflow parity | 70% | Multi-line payment vouchers (cash and bank, receipt and payment) with expense-account support are now implemented alongside manual JV creation and vendor opening balance. Remaining gaps are valued return approval workflows, reversal lifecycle UI, legacy print language, and day-close reconciliation details. |
| Reporting parity | 88% | No new reports in this sprint. All prior placeholder reports remain implemented. Remaining gaps are Sale B/W Date multi-mode output, DAR full layout, and month/year profit layout parity. |
| Navigation parity | 96% | No navigation changes in this sprint. Sidebar closely mirrors the legacy menu. Financial Years and Company Setup are outside the sidebar by design. |

## Baseline Summary

The current ERP has progressed substantially. All major LPG transaction flows are service-backed: multi-line purchases, multi-line sales, cylinder conversion, decanting, empty sale, purchase returns, cylinder returns, and complete day sale. The full opening balance suite (shop, cash, customer, vendor) is complete with transaction-lock guards. Manual journal vouchers are fully implemented. Reporting coverage spans 19 distinct reports. Cash Receipt, Cash Payment, Bank Receipt, and Bank Payment now all support multi-line voucher entry with an arbitrary account selector — vendor, customer, or expense accounts — alongside the retained simple (single-party) mode. Expense-account payments are fully supported via multi-line cash and bank payment. Printable vouchers automatically show all lines via the existing `PrintableTransactionDocument`. The primary remaining gaps are payment/receipt list-history screens, reversal lifecycle UI, day-close reconciliation details, Sale B/W Date multi-mode output, and DAR full layout.
