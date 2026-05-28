# UAT Checklist — Legacy Hasnan ERP vs Fusion4o LPG ERP

**Purpose:** Screen-by-screen acceptance testing when comparing the live legacy system with this clone.

| | Legacy (Evision) | Clone (Fusion4o) |
|---|------------------|------------------|
| **Base URL** | https://hasnantraders.evtsolutionz.com | Local/staging URL (e.g. `http://localhost:3000`) |
| **Login** | Email + password + financial year dropdown | Login ID + password (FY from session) |
| **Reference** | `# ERP Reverse Engineering Report.txt` | `docs/current-erp-inventory.md` |

**How to use:** For each row, open both URLs, perform the action, and mark **Pass / Fail / Partial / N/A**. Record document numbers, totals, and stock figures when comparing numbers.

**Parity legend**

- **Full** — behavior and outputs should match legacy (within active FY data).
- **Partial** — screen exists; layout, filters, or calculations differ (note in Comments).
- **Improved** — intentional difference (better UX, audit, RBAC).
- **Gap** — not implemented or known missing vs legacy.

---

## 0. Authentication & shell

| # | Screen | Legacy path | Clone route | Parity | Test steps | Expected (clone) | Pass |
|---|--------|-------------|-------------|--------|------------|------------------|------|
| 0.1 | Login | `/login` | `/login` | Improved | Sign in with admin user | Redirect to dashboard; session cookie set | |
| 0.2 | Dashboard shell | `/admin` | `/dashboard` | Partial | Compare KPI tiles, bank table, quick links | KPIs load from API; quick links navigate to real routes | |
| 0.3 | Sidebar menu | Left nav all sections | Sidebar groups | Full | Click each group; compare labels | Same module names as legacy groups | |
| 0.4 | Financial year | Login dropdown (legacy stuck 2020-21) | Topbar FY badge + session | Improved | Note FY on both systems | Clone shows active FY label in topbar/sidebar | |
| 0.5 | Logout | Header/logout | Sidebar logout | Full | Log out and back in | Session cleared; login required | |

---

## 1. Configuration

| # | Screen | Legacy path | Clone route | Parity | Test steps | Expected (clone) | Pass |
|---|--------|-------------|-------------|--------|------------|------------------|------|
| 1.1 | Company Information | `/Company` | `/configuration/company-information` | Improved | View/edit name, address, NTN, phone | Saves without broken maps widget | |
| 1.2 | User Management | `/User` | `/configuration/user-management` | Partial | List users; create/edit; reset password | CRUD + role assignment | |
| 1.3 | Map Area | User → Map Area | `/configuration/user-management/[id]/map-area` | Partial | Assign areas to user | Areas saved per user | |
| 1.4 | Cities | `/City` | `/configuration/cities` | Full | Add/edit city | Persists; appears in customer forms | |
| 1.5 | Area | `/area` | `/configuration/area` | Full | Add/edit area linked to city | Persists | |
| 1.6 | Brand Coding | `/Brand` | `/configuration/brand-coding` | Full | Add/edit brand | Used on items | |
| 1.7 | Category Coding | `/Category` | `/configuration/category-coding` | Full | Add/edit category | Used on items | |
| 1.8 | Item Coding | `/Item` | `/masters/items` | Full | Add cylinder item; edit with care | Item list + form | |
| 1.9 | Customer Coding | `/Customer` | `/masters/customers` | Full | Add customer with city/area | Customer available on sale | |
| 1.10 | Vendor Coding | `/Vendor` | `/masters/vendors` | Full | Add vendor | Vendor on purchase | |
| 1.11 | Shop Opening Balance | `/ShopOpeningBalance` | `/configuration/shop-opening-balance` | Partial | View/create opening stock lines | Stock snapshot per item/state | |
| 1.12 | Cash Opening | `/cashopening` | `/configuration/cash-opening` | Partial | Set opening cash | Cash book opening aligns | |
| 1.13 | Day Closing | `/day_closing` | `/operations/day-closing` | Partial | View status; close day; try post on closed day | Block writes on closed date | |
| 1.14 | Customer Opening Balance | `/CustomerOpeningBalance` | `/configuration/customer-opening-balance` | Improved | Legacy page often blank; set balance on clone | Receivable opening posts | |
| 1.15 | Vendor Opening Balance | (legacy via CoA) | `/configuration/vendor-opening-balance` | Partial | Set vendor opening; try edit after txn | Lock after activity | |
| 1.16 | Expense Type Coding | `/ExpenseType` | `/configuration/expense-type-coding` | Full | Add expense type account | Usable on cash payment multi-line | |

---

## 2. Sale / Purchase

| # | Screen | Legacy path | Clone route | Parity | Test steps | Expected (clone) | Pass |
|---|--------|-------------|-------------|--------|------------|------------------|------|
| 2.1 | Purchase Filled Cylinder | `/DirectGIRN`, add GIRN | `/operations/purchase-filled-cylinder` | Partial | Post 2 lines, GST, empty return; print | One receipt #; stock +; vendor Dr; print works | |
| 2.2 | Purchase Empty Cylinder | `/Purchaseempty` | `/sale-purchase/purchase-empty-cylinder` | Gap/N/A | Legacy unused; test clone anyway | Empty stock IN; payable voucher | |
| 2.3 | Purchase Other | `/Purchaseother` | `/sale-purchase/purchase-other` | Gap/N/A | Legacy unused; test clone | Expense/payable voucher | |
| 2.4 | Sale LPG | `/SaleLPG`, add sale | `/operations/sale-lpg` | Partial | Sale 1 customer, 2 lines, security, empty return; print | Issue #; stock out; receivable; Urdu print **Gap** | |
| 2.5 | Complete Day Sale | `/SaleLPG/add_sale_lpg_new` | `/operations/complete-day-sale` | Partial | 2 rows: 1 cash, 1 credit; 3 items max per row | Multiple issue #s; cash receipt on cash row | |
| 2.6 | Decanting Sale | `/decanting` | `/sale-purchase/decanting-sale` | Gap/N/A | Legacy unused | Source stock ↓; sale voucher | |
| 2.7 | Cylinder Conversion | `/CylinderConversion` | `/sale-purchase/cylinder-conversion` | Gap/N/A | Legacy unused | Stock OUT + IN | |
| 2.8 | Empty Sale | `/Emptysale` | `/sale-purchase/empty-sale` | Gap/N/A | Legacy unused | Empty OUT; receivable | |

---

## 3. Returns

| # | Screen | Legacy path | Clone route | Parity | Test steps | Expected (clone) | Pass |
|---|--------|-------------|-------------|--------|------------|------------------|------|
| 3.1 | Cylinder Return | `/Salereturn` | `/operations/cylinder-return` | Partial | Empty return qty; then filled return with amount | Return #; cylinder balance ↓; credit if filled | |
| 3.2 | Purchase Return Cylinder | `/Purchasereturn` | `/returns/purchase-return-cylinder` | Gap/N/A | Legacy unused | Stock + vendor credit | |
| 3.3 | Purchase Return Other | `/Purchasereturn` (other) | `/returns/purchase-return-other` | Gap/N/A | Legacy URL conflated | Expense reversal | |

---

## 4. Payment / Receipt

| # | Screen | Legacy path | Clone route | Parity | Test steps | Expected (clone) | Pass |
|---|--------|-------------|-------------|--------|------------|------------------|------|
| 4.1 | Cash Payment | `/Multiplecashpayment` | `/payments/cash-payment` | Partial | Simple vendor payment; then multi-line expense | Balanced voucher CP-*; print | |
| 4.2 | Cash Receipt | `/Multiplecashreceipt` | `/payments/cash-receipt` | Partial | Multi-line receipt from 2 accounts | CR-*; cash Dr total | |
| 4.3 | Security Receipt | `/SecurityReceipt` | `/payments/security-receipt` | Partial | Customer + cylinder + qty + amount | Security liability; print | |
| 4.4 | Chart of Accounts | `/Chartofaccounts` | `/accounting/chart-of-accounts` | Partial | Add account; compare hierarchy depth | Flat CRUD (no tree UI) | |
| 4.5 | Journal Vouchers | `/Journal_voucher` | `/payments/journal-vouchers` | Improved | Balanced manual JV | JV-*; list shows entry | |
| 4.6 | Bank Payment | `/Account_bank_payment` (BP) | `/payments/bank-payment` | Partial | Pay vendor from HBL (or test bank) | BP-*; bank Cr | |
| 4.7 | Bank Receipt | `/Account_bank_payment` (BR) | `/payments/bank-receipt` | Partial | Customer deposit to bank | BR-*; bank Dr | |
| 4.8 | Bank Payments / Receipt hub | List on legacy | `/payments/bank-payments-receipts` | Partial | Filter bank vouchers | Links to bank payment/receipt | |

---

## 5. Reports

| # | Screen | Legacy path | Clone route | Parity | Test steps | Expected (clone) | Pass |
|---|--------|-------------|-------------|--------|------------|------------------|------|
| 5.1 | Sale B/W Date | `/SaleDateReport` | `/reports/sale-between-dates` | Partial | Same date range on both; compare row count/totals | Flat table only (no item/amount modes) | |
| 5.2 | Cylinder Conversion B/W Date | `/ConversionDateReport` | `/reports/cylinder-conversion-between-dates` | Partial | Date filter | Conversion rows | |
| 5.3 | One Customer Sale History | `/SaleDateReport/single_customer_report` | `/reports/one-customer-sale-history` | Partial | Pick one customer | Same customer sales as 5.1 subset | |
| 5.4 | Stock Report | `/StockReport` | `/reports/stock-summary` | Partial | Compare filled/empty per item | Totals from stock ledger | |
| 5.5 | Cash Book | `/CashBookReport` | `/reports/cash-book` | Partial | Cash account, 7-day range | Opening + running balance | |
| 5.6 | Bank Book | (legacy cash book banks) | `/reports/bank-book` | Improved | Select bank; date range | Bank-only movements | |
| 5.7 | Vendor Wise Receiving | `/VendorWiseReport` | `/reports/vendor-wise-receiving` | Partial | Vendor + dates | Purchase receipts | |
| 5.8 | General Ledger | `/VendorLedger` | `/reports/general-ledger` | Partial | Any GL account | Voucher lines + balance | |
| 5.9 | Customer Ledger | `/CustomerLedger` | `/reports/customer-ledger` | Partial | Same customer/dates | Opening + running balance | |
| 5.10 | Sale Return Report | `/Salereturnreport` | `/reports/sale-return` | Partial | Date range | Cylinder returns listed | |
| 5.11 | Purchase Return Report | `/Purchasereturnreport` | `/reports/purchase-return` | Partial | Date range | Purchase returns | |
| 5.12 | Customer Stock Ledger | `/Customerstockledger` | `/reports/customer-stock-ledger` | Partial | Customer + item + dates | Movement history | |
| 5.13 | Daily Activity Report | `/DAR` | `/reports/daily-activity` | Gap | Compare sections vs legacy DAR | Clone: count summary only | |
| 5.14 | Access Cylinders | `/Accesscylinders` | `/reports/customer-cylinder-balances` | Partial | Legacy has 2 sub-reports | Outstanding cylinders per customer | |
| 5.15 | Salewise Profit | `/SalewiseProfit` | `/reports/salewise-profit` | Partial | Same range; spot-check profit % | Weighted-avg cost approximation | |
| 5.16 | Profit / Loss | `/ProfitReport` | `/reports/profit-loss` | Partial | Month range | Revenue − expense style | |

---

## 6. Database & admin (clone-only extras)

| # | Screen | Legacy path | Clone route | Parity | Test steps | Expected (clone) | Pass |
|---|--------|-------------|-------------|--------|------------|------------------|------|
| 6.1 | Database Backup | `/Db_backup` | `/database-backup` | Partial | Trigger backup; download file | File in backup list | |
| 6.2 | Audit Log | — | `/audit-log` | Improved | Filter by module after a sale | Entry with before/after | |
| 6.3 | Roles & Permissions | — | `/settings/roles` | Improved | Restrict report for test role | Sidebar hides blocked routes | |
| 6.4 | Transaction Reversals | — | `/operations/reversals` | Improved | Reverse a test sale by doc # | Compensating entries | |
| 6.5 | Stock Ledger | — | `/stock-ledger` | Improved | Filter item + dates | Immutable movements | |
| 6.6 | Voucher list | — | `/accounting/vouchers` | Improved | List recent vouchers | Open detail | |

---

## 7. End-to-end day script (recommended)

Run once on **both** systems with the same test data (or parallel document numbers after migration):

1. **Morning:** Cash opening visible in cash book opening (if applicable).
2. **Purchase:** Post filled cylinder GIRN for vendor A, 2×11.8kg — note receipt # and stock.
3. **Sale:** Sale LPG to customer B — note issue #, receivable, filled stock ↓.
4. **Return:** Empty cylinder return from customer B.
5. **Receipt:** Cash receipt from customer B (partial or full).
6. **Reports:** Customer ledger, stock summary, cash book for today.
7. **Close:** Day closing — confirm next-day write blocked (clone).

| Step | Legacy doc # | Clone doc # | Legacy total | Clone total | Match? |
|------|--------------|-------------|--------------|-------------|--------|
| Purchase | | | | | |
| Sale | | | | | |
| Return | | | | | |
| Receipt | | | | | |

---

## 8. Known intentional gaps (do not fail UAT without product sign-off)

| Item | Legacy | Clone |
|------|--------|-------|
| Sale invoice Urdu/English | Yes | Not yet |
| Sale B/W Date output modes | Item/amount/type-wise | Single table |
| DAR full layout | Sectional | Count summary |
| Inline stock check on sale | Yes | Not yet |
| Inline customer balance on sale | Yes | Not yet |
| Payment/receipt history screen | Implicit lists | Use voucher list |
| Day-close cash reconciliation UI | Partial | Basic close/reopen |
| Global search (topbar) | — | Placeholder (disabled) |

---

## 9. Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Shop operator | | | |
| Accountant | | | |
| Product owner | | | |

**Last updated:** 2026-05-28
