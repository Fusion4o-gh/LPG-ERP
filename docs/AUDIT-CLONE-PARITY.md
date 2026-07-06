# Clone-Parity Audit — LPG-ERP vs hasnantraders.evtsolutionz.com

**Date:** 2026-07-06 · **Auditor:** Claude (live walkthrough of the reference site, logged in as Admin, + full local codebase inventory)

## Verdict

The local build is a **functional superset** of the reference system at the navigation and
workflow level. Every one of the 55 reference menu screens has a local counterpart, and the
key transaction forms carry the same fields and calculation flow. **The only blocking risk
for go-live is the data migration path**: the reference backup has not actually been
obtained yet (the file in Downloads is an HTML page, not a SQL dump), and the local system
has no importer for it.

---

## 1. Navigation / screen parity (reference → local)

### Configuration (15/15 present)
| Reference | Local route | Status |
|---|---|---|
| Company Information (`/Company`) | `/configuration/company-information` | ✅ |
| User Management (`/User`) | `/configuration/user-management` | ✅ |
| Cities (`/City`) | `/configuration/cities` | ✅ |
| Area (`/area`) | `/configuration/area` | ✅ |
| Brand Coding (`/Brand`) | `/configuration/brand-coding` | ✅ |
| Category Coding (`/Category`) | `/configuration/category-coding` | ✅ |
| Item Coding (`/item`) | `/masters/items` | ✅ |
| Customer Coding (`/customer`) | `/masters/customers` | ✅ |
| Vendor Coding (`/vendor`) | `/masters/vendors` | ✅ |
| Bank Coding (`/bank`) | `/configuration/bank-coding` | ✅ |
| Shop Opening Balance | `/configuration/shop-opening-balance` | ✅ |
| Cash Opening | `/configuration/cash-opening` | ✅ |
| Day Closing (`/day_closing`) | `/operations/day-closing` | ✅ |
| Customer Opening Balance | `/configuration/customer-opening-balance` | ✅ |
| Expense Type Coding (`/ExpenseType`) | `/configuration/expense-type-coding` | ✅ |

### Sale/Purchase (7/7 present)
| Reference | Local route | Status |
|---|---|---|
| Purchase Filled Cylinder (`/DirectGIRN`) | `/operations/purchase-filled-cylinder` | ✅ |
| Purchase Empty Cylinder (`/Purchaseempty`) | `/sale-purchase/purchase-empty-cylinder` | ✅ |
| Purchase Other (`/Purchaseother`) | `/sale-purchase/purchase-other` | ✅ |
| Sale LPG single (`/SaleLPG/add_sale_lpg`) | `/operations/sale-lpg` | ✅ |
| Complete Day Sale (`/SaleLPG/add_sale_lpg_new`) | `/operations/complete-day-sale` (batch API) | ✅ |
| Decanting Sale (`/decanting`) | `/sale-purchase/decanting-sale` | ✅ |
| Cylinder Conversion (`/CylinderConversion`) | `/sale-purchase/cylinder-conversion` | ✅ |
| Empty Sale (`/Emptysale`) | `/sale-purchase/empty-sale` | ✅ |

### Return (3/3 present)
Cylinder Return (`/Salereturn`) → `/operations/cylinder-return` ✅ ·
Purchase Return Cylinder → `/returns/purchase-return-cylinder` ✅ ·
Purchase Return Other → `/returns/purchase-return-other` ✅

### Payment/Receipt (6/6 present)
Cash Payment (`/Multiplecashpayment`) → `/payments/cash-payment` ✅ ·
Cash Receipt (`/Multiplecashreceipt`) → `/payments/cash-receipt` ✅ ·
Security Receipt → `/payments/security-receipt` ✅ ·
Chart of Account → `/accounting/chart-of-accounts` ✅ ·
Journal Vouchers → `/payments/journal-vouchers` ✅ ·
Bank Payments / Receipt (`/Account_bank_payment`) → `/payments/bank-payments-receipts` ✅

### Reports (17/17 present)
Sale B/W Date ✅ · Cylinder Conversion B/W Date ✅ · One Customer Sale History ✅ ·
Stock Report ✅ · Cash Book ✅ · Vendor Wise Receiving ✅ · General Ledger ✅ ·
Customer Ledger ✅ · Sale Return Report ✅ · Purchase Return Report ✅ ·
Customer Stock Ledger ✅ · Daily Activity Report (`/DAR`) ✅ ·
Access Cylinders (`/Accesscylinders`) → `/reports/customer-cylinder-balances` ✅ ·
Salewise Profit ✅ · Profit/Loss ✅ · Chart Of Account Report ✅ · Group Summary ✅

### Database Backup (1/1) ✅ (export side; see Gap G1/G2 for import)

### Dashboard parity ✅
Reference KPIs: Today Cash, Cash Position, Payables, Receivables, Today's Sale, EXPENSES,
M EXPENSES + Banks Position table + colored quick-link tiles. Local `DashboardClient.tsx`
implements all 7 KPIs and the Bank Position table.

### Local-only extras (not in reference — no action needed)
Bank Book, Stock by Location, Trial Balance, Balance Sheet, Vendor Ledger report,
Voucher List, Warehouse Transfer, Physical Count, Reversals, Audit Log, RBAC roles,
Fleet/Plants/Transporters/Vehicles/Drivers, Stock Locations, Bulk Products & bulk opening,
Vendor Opening Balance, Appearance, Change Password, plus the not-yet-wired
Import/Plant/Dollar modules (`PENDING_NAV`).

---

## 2. Workflow field-level spot checks (reference forms inspected live)

| Screen | Reference fields verified | Local counterpart |
|---|---|---|
| Sale LPG (single) | customer, date, saletype, remarks, 11.8kg price, item/qty/price/gst/security, empty return, filled stock, gas return (qty/rate/total), discount, security amt, pay_mode, bank, cheque no/date | `SaleLpgForm.tsx` (incl. `11.8` auto-pricing) ✅ |
| Complete Day Sale | customer, date, item[]/qty[]/return[] rows, total, pay_mode, bank, cheque | `BatchSaleForm.tsx` + `/api/sales/lpg/batch` ✅ |
| Purchase Filled Cyl. | vendor, date, item/type/qty/unitcost/gst, empty return/stock, discount, net payable, **split bank+cash payment** (enter_amount_bank / enter_amount_cash with running balances) | `PurchaseFilledCylinderForm.tsx` + `SettlementPanel.tsx` (discount ✅) — **verify split-payment parity (G3)** |
| Cylinder Return | customer, date, item/type/qty/new_stock/gas amt/security, pay_mode/bank/cheque | `CylinderReturnForm.tsx` ✅ |
| Cash Payment / Receipt | date, multi-line: account, particulars, amount | `MultiLinePaymentForm.tsx` ✅ |
| Journal Voucher | date, multi-line: account, particulars, debit, credit | `JournalVoucherPage.tsx` ✅ |
| Bank Payment/Receipt | date, type (payment/receipt), bank, account, cheque no, amount, multi-line | `BankPaymentsReceiptsClient.tsx` ✅ |
| Security Receipt | date, account, item, qty, stock, security recv, pay_mode/bank/cheque | `SecurityReceiptForm.tsx` ✅ |
| Cylinder Conversion | date, from_item/from_stock/from_qty → to_item/to_stock/to_qty rows | `CylinderConversionForm.tsx` ✅ |
| Day Closing | shows "Last Posted Date", single date input to post | `DayClosingPanel.tsx` + reopen API ✅ |
| Item Coding | category, brand, item name, sale price, status, image | `/masters/items` + `/api/items` ✅ |
| Customer Coding | name, email, contact person, address 1/2, country/city/area, cell, segment, phone, reg date/no, VAT, opening balance + Dr/Cr type, credit days, status | `/masters/customers` + `/api/customers` — **verify all fields incl. segment/regno/vatno/creditdays (G4)** |

---

## 3. Gaps and risks (the actual plan)

### G1 — BLOCKER: The real reference backup has not been captured
`C:\Users\Lenovo\Downloads\Db_backup` (49 KB) is the **HTML of the backup page**, not a
database dump. The real backup on the reference site is produced by the form at
`/Db_backup` (POST with `from_date`, "BackUp" button) which returns the actual MySQL dump.

**Action (user):** log into the reference site, open Database Backup, press **BackUp**, and
save the resulting `.sql` file. Verify it starts with `-- MySQL dump` / `CREATE TABLE`, not
`<!DOCTYPE html>`. Keep a copy off-machine.

### G2 — BLOCKER: No import path for the reference data
The local backup module (`src/server/services/backup/database-backup.ts`) is
**export-only** (`pg_dump` of the local Postgres). There is no ETL from the reference
MySQL/CodeIgniter schema into the Prisma schema.

**Action (build):** a one-time migration CLI (`scripts/import-legacy-backup.ts`):
1. Parse the MySQL dump (or load into a scratch MySQL/MariaDB and read via connector).
2. Map legacy tables → Prisma models:
   - customers → `Customer` (+ opening balances → `CustomerCylinderBalance`, opening JVs)
   - vendors → `Vendor`, banks → `Bank`, city/area → `City`/`Area`
   - brand/category/item (+ sale price) → `Brand`/`Category`/`Item`/`ItemPrice`
   - chart of accounts (the 10-digit acodes, e.g. `2004002001`) → `ChartAccount`
     **preserving the legacy account codes** so old ledger references remain valid
   - expense types → `ChartAccount` expense group
   - all transaction tables (sales, purchases, returns, conversions, payments, receipts,
     JVs, bank payments) → `AccountingVoucher`/`AccountingVoucherLine` +
     `StockLedgerEntry` + `DocumentSequence` seeding so new document numbers continue
     from the legacy sequence
   - users → `User` (fresh passwords; legacy hashes are CodeIgniter-style)
3. Run inside one transaction per entity group; log rejected rows to a CSV.

### G3 — Verify split bank+cash settlement on Purchase Filled Cylinder
Reference allows paying one purchase partly from bank and partly from cash in the same
entry (with live balance display). Confirm `SettlementPanel.tsx` supports both lines at
once; if not, add it.

### G4 — Field-by-field master-form diff
Confirm customer form carries: segment, reg no, VAT no, credit days, address2,
contact person, country. Same exercise for vendor and item (item image upload exists in
reference). Add any missing columns to Prisma + forms.

### G5 — Reconciliation gate before go-live (proves "no risk")
After import, auto-compare against the reference site's own reports (same dates):
1. **Trial balance / Group Summary** totals match to the rupee.
2. **Customer Ledger closing balance** for 10 sampled customers matches.
3. **Stock Report** per-item filled/empty quantities match.
4. **Access Cylinders** (customer cylinder balances) matches.
5. **Cash Book + Bank balances** match the dashboard Banks Position table.
6. **Payables / Receivables / Expense** KPI totals match the reference dashboard.
Ship this as `scripts/verify-migration.ts` producing a pass/fail report.

### G6 — Day-closing cutover procedure
Reference "Last Posted Date" was 2023-03-29 with FY 2020-21 selected — the legacy data
spans multiple financial years. The importer must create all `FinancialYear` rows and tag
every voucher to the right year, then set the local Day Closing posted-date to the legacy
value at cutover.

---

## 4. Execution order

| Phase | Work | Depends on |
|---|---|---|
| 1 | Obtain real MySQL dump from reference (user action, G1) | — |
| 2 | Schema mapping doc: legacy tables → Prisma models (from actual dump) | 1 |
| 3 | G4 field diff + any Prisma/form additions; G3 settlement check | — (parallel) |
| 4 | Build `import-legacy-backup.ts` (G2, G6) | 2, 3 |
| 5 | Build `verify-migration.ts` reconciliation (G5) | 4 |
| 6 | Dry-run import on a scratch DB, fix rejects, re-run until reconciliation passes | 5 |
| 7 | Cutover: final backup from reference → import → verify → start entering in new system | 6 |
