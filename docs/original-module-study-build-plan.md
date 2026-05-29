# Original LPG ERP Module Study and Build Plan

Captured: 2026-05-29  
Source: `https://hasnantraders.evtsolutionz.com/`  
Raw audit artifact: `docs/original-live-audit.json`

This document is the working plan for cloning the original Hasnan Traders LPG ERP while keeping the rebuilt interface cleaner, safer, and easier to operate. The live original system was audited read-only after login. No production records were created, edited, posted, deleted, printed, or backed up during this pass.

## 1. Audit Coverage

The live audit captured:

- 55 navigation entries from the original sidebar/header.
- 50 sidebar/list/report routes.
- 31 add/edit/entry forms.
- Dashboard metrics, quick links, alerts, report filters, form fields, table headers, and visible actions.

The original app is a single-tenant LPG distribution ERP using a legacy Bootstrap/Ace shell. It is still running under the visible financial year `2020-21` even though the current business date is 2026. The clone should preserve business behavior, not the old technical constraints.

## 2. Original Navigation Map

| Group | Original module | Original route | Clone target |
|---|---|---|---|
| Dashboard | Dashboard | `/admin` | `/dashboard` |
| Configuration | Company Information | `/Company` | `/configuration/company-information` |
| Configuration | User Management | `/User` | `/configuration/user-management` |
| Configuration | Cities | `/City` | `/configuration/cities` |
| Configuration | Area | `/area` | `/configuration/area` |
| Configuration | Brand Coding | `/Brand` | `/configuration/brand-coding` |
| Configuration | Category Coding | `/Category` | `/configuration/category-coding` |
| Configuration | Item Coding | `/item` | `/masters/items` |
| Configuration | Customer Coding | `/customer` | `/masters/customers` |
| Configuration | Vendor Coding | `/vendor` | `/masters/vendors` |
| Configuration | Bank Coding | `/bank` | `/banks` and sidebar alias under Configuration |
| Configuration | Shop Opening Balance | `/ShopOpeningBalance` | `/configuration/shop-opening-balance` |
| Configuration | Cash Opening | `/cashopening` | `/configuration/cash-opening` |
| Configuration | Day Closing | `/day_closing` | `/operations/day-closing` |
| Configuration | CustomerOpeningBalance | `/CustomerOpeningBalance` | `/configuration/customer-opening-balance` |
| Configuration | Expense Type Coding | `/ExpenseType` | `/configuration/expense-type-coding` |
| Sale/Purchase | Purchase Filled Cylinder | `/DirectGIRN` | `/operations/purchase-filled-cylinder` |
| Sale/Purchase | Purchase Empty Cylinder | `/Purchaseempty` | `/sale-purchase/purchase-empty-cylinder` |
| Sale/Purchase | Purchase Other | `/Purchaseother` | `/sale-purchase/purchase-other` |
| Sale/Purchase | Sale LPG | `/SaleLPG` | `/operations/sale-lpg` |
| Sale/Purchase | Decanting Sale | `/decanting` | `/sale-purchase/decanting-sale` |
| Sale/Purchase | Cylinder Conversion | `/CylinderConversion` | `/sale-purchase/cylinder-conversion` |
| Sale/Purchase | Empty Sale | `/Emptysale` | `/sale-purchase/empty-sale` |
| Return | Cylinder Return | `/Salereturn` | `/operations/cylinder-return` |
| Return | Purchase Return Cylinder | `/Purchasereturn` | `/returns/purchase-return-cylinder` |
| Return | Purchase Return Other | `/Purchasereturnother` | `/returns/purchase-return-other` |
| Payment/Receipt | Cash Payment | `/Multiplecashpayment` | `/payments/cash-payment` |
| Payment/Receipt | Cash Receipt | `/Multiplecashreceipt` | `/payments/cash-receipt` |
| Payment/Receipt | Security Receipt | `/SecurityReceipt` | `/payments/security-receipt` |
| Payment/Receipt | Chart of Account | `/Chartofaccounts` | `/accounting/chart-of-accounts` |
| Payment/Receipt | Journal Vouchers | `/Journal_voucher` | `/payments/journal-vouchers` |
| Payment/Receipt | Bank Payments / Receipt | `/Account_bank_payment` | `/payments/bank-payments-receipts`, `/payments/bank-payment`, `/payments/bank-receipt` |
| Reports | Sale B/W Date | `/SaleDateReport` | `/reports/sale-between-dates` |
| Reports | Cylinder Conversion B/W Date | `/ConversionDateReport` | `/reports/cylinder-conversion-between-dates` |
| Reports | One Customer Sale History | `/SaleDateReport/single_customer_report` | `/reports/one-customer-sale-history` |
| Reports | Stock Report | `/StockReport` | `/reports/stock-summary` |
| Reports | Cash Book | `/CashBookReport` | `/reports/cash-book` |
| Reports | Vendor Wise Receiving Report | `/VendorWiseReport` | `/reports/vendor-wise-receiving` |
| Reports | General Ledger | `/VendorLedger` | `/reports/general-ledger` |
| Reports | Customer Ledger | `/CustomerLedger` | `/reports/customer-ledger` |
| Reports | Sale Return Report | `/Salereturnreport` | `/reports/sale-return` |
| Reports | Purchase Return Report | `/Purchasereturnreport` | `/reports/purchase-return` |
| Reports | Customer Stock Ledger | `/Customerstockledger` | `/reports/customer-stock-ledger` |
| Reports | Daily Activity Report | `/DAR` | `/reports/daily-activity` |
| Reports | Access Cylinders | `/Accesscylinders` | `/reports/customer-cylinder-balances` |
| Reports | Salewise Profit | `/SalewiseProfit` | `/reports/salewise-profit` |
| Reports | Profit loss report | `/Profit_loss_report` | `/reports/profit-loss` |
| Reports | Chart Of Account Report | `/Chart_of_account` | New report route |
| Reports | Group Summary | `/Groupsummary` | New report route |
| Database | Database Backup | `/Db_backup` | `/database-backup` |

## 3. Original Shell and Dashboard

Original behavior:

- Header shows `HASNAN TRADERS (Financial Year : 2020-21)`.
- Header user menu includes change password, logout, and Urdu language switch.
- Dashboard shows a red database-backup warning if backup is stale.
- Dashboard shows login success alerts after login.
- Quick-link stack includes Single Sale, Complete Day Sale, Purchase, Payment, Receipt, Cylinder Return, Customer Ledger, Stock Report, Daily Activity, Customer Stock Ledger, Cash Book, Profit/Loss Report.
- KPI tiles show Today Cash, Cash Position, Payables, Receivables, Today's Sale, Expenses, and M Expenses.
- Bank Position table lists each bank account with Dr/Cr balance and links into the general ledger.
- Current stock and sale stats are collapsible panels.

Clone direction:

- Keep the modern shell, but add financial-year switch/selection behavior.
- Keep the backup warning as a real operational signal, not a permanent alert.
- Make dashboard bank balances clickable into ledger/account detail.
- Add collapsible current stock and sale stats panels to mirror operator expectations.
- Keep quick links dense and color-coded enough for fast shop operation.

## 4. Configuration Modules

### Company Information

Original fields:

- Business Name, Company Logo, Owner Name, Address, Phone No, Email.
- NTN No, GST No.
- Centralized Pricing.
- Show Default Date.
- Stock Available Check.
- Redirect on Same Page.
- Start Time, End Time.
- Working days: Monday through Sunday.

Build requirements:

- Extend company settings to include logo, GST No, default-date behavior, redirect behavior, working hours, and working-day toggles.
- Preserve current clone improvements: no broken Google Maps dependency, clean validation, audit log.
- Use these settings in transaction screens: stock check, centralized pricing, default date, same-page redirect after save.

### User Management

Original fields:

- User Name, Login Id, Password, Status.
- User list supports access role and map area through actions.
- Header menu supports Change Password.

Build requirements:

- Keep current user CRUD and RBAC.
- Add self-service Change Password.
- Make Map Area visible from user list and enforce area restrictions in customer lookup and transaction/report filters.
- Add active/locked status parity.

### City, Area, Brand, Category

Original fields:

- City: Country, City Name, Status.
- Area: Country, City, Area Name, Status.
- Brand: Brand Name, Status.
- Category: Category Name, Status.

Build requirements:

- Current CRUD is close.
- Country can remain defaulted if single-country is a product decision, but field parity should be documented.
- Ensure active/inactive filtering works consistently in downstream selects.

### Item Coding

Original fields:

- Language toggles.
- Category, Brand Name, Item Name, Security, Status.

Build requirements:

- Current item model should expose default security clearly.
- Add category/brand filtering and status controls if missing from UI.
- Keep item code for data quality; original relies heavily on names, but clone should retain codes.

### Customer Coding

Original fields:

- Language toggles.
- Customer Name, Email, Contact Person.
- Address 1, Address 2.
- Country, City, Area.
- Cell No, Segment Type, Phone No.
- Registration Date.
- NTN, GST.
- Opening Balance, Opening Type.
- Credit Days, Status.

Build requirements:

- Extend customer schema/UI for contact person, address 2, segment type, registration date, NTN, GST, credit days.
- Keep separate Customer Opening Balance module, but allow migration/import of original opening balance fields.
- Enforce area access based on logged-in user.

### Vendor Coding

Original fields:

- Language toggles.
- Vendor Name, Contact Person, Address.
- Country, City, Area.
- Cell No, Phone No, Registration Date.
- Company Reg No, VAT No.
- Opening Balance, Opening Type.
- Credit Days, Status.
- Multiple brand mapping fields.

Build requirements:

- Extend vendor UI for contact person, city/area, registration/tax fields, credit days.
- Add vendor-brand mapping if purchase workflows depend on vendor-specific brands.
- Keep vendor opening balance module for accounting correctness.

### Bank Coding

Original fields:

- Bank Name, Phone No, Address.
- Opening Balance, Account No, Opening Type, Status.
- Email, Country, City, Area, Cell No, Segment Type.
- Registration Date, Company Reg No, VAT No, Credit Days.

Build requirements:

- Add `Bank Coding` under Configuration, not only the current `/banks` utility route.
- Extend bank record fields at least for account number, opening balance/type, phone, address, status.
- Keep bank accounts tied to chart accounts.

### Opening Balances

Original modules:

- Shop Opening Balance list/add route.
- Cash Opening with Account and Amount.
- CustomerOpeningBalance route currently appears blank in audit.

Build requirements:

- Current clone is stronger because it has shop, cash, customer, and vendor opening balances.
- Add a one-time migration lock: opening balances should not be casually added after live activity exists.
- Preserve transaction-lock guards.

### Day Closing

Original fields/actions:

- Close Day.
- Unclose last Posted Day.
- Last posted date title.

Build requirements:

- Current close/reopen foundation exists.
- Add historical close list, cash reconciliation details, close-day report, and approval workflow for reopen.
- Surface last closed date prominently like original.

### Expense Type Coding

Original fields:

- Expense Name, Opening Balance, Opening Type, Type, Status.

Build requirements:

- Current expense type CRUD should create/update chart accounts.
- Add opening balance/type fields if not already represented.
- Make expense types easy to select in cash/bank payment.

## 5. Sale/Purchase Workflows

### Purchase Filled Cylinder

Original fields:

- Vendor, Date, Remarks, 11.8 KG Price.
- Line table: Item, Type, Recv Qty (Filled), Unit Price, GST %, Empty Return, Empty Stock, GST Amount, Exc GST Amount, Inc GST Amount, Total.
- Bill details: Total Bill, Discount, Net Payable.
- Settlement: Pay Mode, Bank Name, Cheque No, Cheque Date, bank amount, Banks Balance, cash amount, Cash In Hand Balance.

Clone status:

- Multi-line purchase, GST, empty return, stock posting, voucher, audit, print exist.
- Missing or incomplete parity: discount/net payable, immediate cash/bank settlement on purchase, bank/cash balance preview, visible empty-stock context.

Build requirements:

- Add settlement section reusable across purchases/sales/returns.
- Support split cash/bank payment if original permits both bank amount and cash amount.
- Post payable and optional immediate payment vouchers atomically.
- Display cash/bank balances before submit.

### Purchase Empty Cylinder

Original fields:

- Vendor, Date, Remarks.
- Line table: Item, Type, Recv Qty (Empty), Unit Price, GST %, GST Amount, Exc GST Amount, Inc GST Amount.
- Bill details and settlement same as purchase filled.

Build requirements:

- Current module exists.
- Add legacy settlement block, discount/net payable, balance previews.

### Purchase Other

Original fields:

- Vendor, Date, Remarks.
- Line table: Category, Item, Recv Qty (other), Unit Price, GST %, GST Amount, Exc GST Amount, Inc GST Amount.
- Bill details and settlement same as purchase modules.

Build requirements:

- Current module exists.
- Ensure category/item behavior supports non-cylinder purchases or map to expense/account items.
- Add settlement block and discount/net payable.

### Sale LPG

Original fields:

- English/Urdu print language.
- Customer with inline Balance.
- Date, Sale Type (`Direct`, `From Gasable`), Remarks, 11.8 KG Price.
- Line table: Item, Sale Qty, Gas/Unit price, GST, Security/Cylinder price, Empty Cylinder, Empty return, Filled Stock, Security Total, GST Amt, Ex GST Total, Inc GST Total, Total.
- Gas Return block: Return Gas in KG, Rate, Total.
- Amount received block: Total Bill, Discount, Net Bill, Security Amount, Gas Amount, Amount Received.
- Settlement: Receive Mode, Bank, Cheque/DD No, Cheque Date.

Clone status:

- Multi-line sale, GST, security, empty returns, stock check on save, language selector, and sale type are present.
- Missing or incomplete parity: inline balance value, live filled stock value, discount/net bill, gas return block, amount received/payment mode behavior, bank/cheque settlement, cash/bank balance context, fully verified Urdu print.

Build requirements:

- Add customer balance panel that updates after customer selection.
- Add live item stock preview per line before submit.
- Add discount/net bill calculations.
- Add gas return block if still used by business.
- Add immediate receipt settlement from Sale LPG, including cash/bank/cheque fields.
- Ensure sale save posts sale voucher, stock, cylinder balance, security liability, and optional receipt in one transaction.

### Complete Day Sale

Original fields:

- English/Urdu print language.
- Date, Remarks.
- Row structure: customer, up to three item selectors, qty and return fields for each item, stock fields for item 1/2/3, amount received, pay mode, bank, cheque number/date.
- Add row, Submit.

Clone status:

- Batch sale exists with date/remarks, payment type, amount received, and up to three items.
- Needs closer parity for per-item return qty, per-item stock preview, language, bank/cheque settlement, and batch print/story.

Build requirements:

- Add per-item return qty columns.
- Add live stock fields.
- Add cash/bank/cheque handling for cash rows and bank rows.
- Keep modern row layout but make it fast for keyboard entry.

### Decanting Sale

Original fields:

- Item, Stock.
- Table: Sr.No, Cylinder, Total Weight, Sold, Balance in KG, Sold Amount, Make Sale, Finish, Report.

Clone status:

- Decanting sale exists but current model should be checked against original staged workflow.

Build requirements:

- Decide if decanting remains a full parity workflow or archival/unused module.
- If retained, model decanting batches with total weight, sold amount, balance kg, finish state, and report.

### Cylinder Conversion

Original fields:

- Date, Remarks.
- Source filled item, Filled Stock, Qty To Convert.
- Destination empty item, Empty Stock, Qty To Convert.
- Line table: Item, Empty Stock, Conversion Qty, Action, Total.

Clone status:

- Conversion exists with source/destination stock movement.

Build requirements:

- Add live source/destination stock preview and original-style line table if missing.

### Empty Sale

Original fields:

- English/Urdu language.
- Customer, Date, Sale Type, Remarks.
- Line table: Item, Sale Qty, Unit price, GST, Empty Stock, GST Amt, Ex GST Total, Inc GST Total, Total.
- Gas Return block.
- Amount Received block: Total Bill, Amount Received, Pay Mode, Bank, Cheque/DD No, Cheque Date.

Build requirements:

- Add empty-stock preview and settlement block.
- Verify it posts empty stock out and customer receivable/receipt correctly.

## 6. Return Workflows

### Cylinder Return

Original fields:

- Customer, Date, Remarks.
- Line table: Item, Type, Return Qty, Price, Gas Amount, Security, Total.
- Amount Received Details: Total Bill, Amount Received, Pay Mode, Bank, Cheque/DD No, Cheque Date.

Clone status:

- Customer cylinder return exists and handles filled/empty return types.
- Missing parity: amount received settlement section, gas/security amount detail, bank/cheque handling.

Build requirements:

- Add valued return mode and settlement block.
- Distinguish pure empty return from financial return/credit.
- Add approval if valued returns can reduce customer balance.

### Purchase Return Cylinder

Original fields:

- Vendor, Date, Remarks.
- Line table: Item, Type, Return Qty, Unit Price, Stock, Total.

Build requirements:

- Current module exists.
- Add stock preview and ensure vendor credit/debit behavior matches original.

### Purchase Return Other

Original fields:

- Vendor, Date, Remarks.
- Line table: Category, Item, Qty, Unit Price, Stock, Total.

Build requirements:

- Current module exists.
- Add category/item parity and stock preview if applicable.

## 7. Payment/Receipt and Accounting

### Cash Payment

Original fields:

- Date, Voucher Number.
- Multi-line table: Srno, Account Name, Particulars, Amount, Action, Total.
- Cash Balance shown on screen.

Clone status:

- Multi-line cash payment exists and is more flexible.
- Missing parity: voucher number preview and cash balance preview.

Build requirements:

- Show next voucher number before submit.
- Show current cash balance and projected balance.

### Cash Receipt

Original fields:

- Date, Voucher Number.
- Multi-line table: Srno, Account Name, Particulars, Amount, Action, Total.

Clone status:

- Multi-line cash receipt exists.

Build requirements:

- Show next voucher number and projected cash balance.
- Add list/history route parity for receipts/payments.

### Security Receipt

Original fields:

- Date, Customer Name, Item, Qty, Stock Issued, Security Received.
- Pay Mode, Bank, Cheque Number, Cheque Date, Remarks.

Clone status:

- Security receipt exists, but prior inventory noted quantity capture was missing or incomplete.

Build requirements:

- Add qty and stock-issued fields as first-class inputs.
- Support cash/bank/cheque payment mode.
- Post security liability and customer cylinder/security balance.

### Chart of Accounts

Original behavior:

- Tree interface with Expand All and Collapse All.
- Account creation supports account name, parent/general account fields, sub ledger, debit/credit limit, opening balance/type, balance sheet flag, phone/mobile/NTN/email/contact/address fields.

Clone status:

- Basic flat chart account CRUD exists.

Build requirements:

- Add tree/hierarchy view.
- Expose parent account, level, control/system flags, balance sheet flag, opening fields.
- Preserve code-based accounting for reliability.

### Journal Vouchers

Original fields:

- Date, Voucher Number.
- Multi-line table: Account Name, Particulars, Debit, Credit, Action, Total.

Clone status:

- Manual journal voucher is strong.

Build requirements:

- Add voucher number preview.
- Keep balanced enforcement and print support.

### Bank Payments / Receipt

Original fields:

- Date, Transaction Type (`Bank Payment` etc.).
- Bank Name.
- Multi-line table: Account Name, Particulars, Cheque #, Amount, Action, Total.

Clone status:

- Clone has separate bank payment and bank receipt routes plus hub.

Build requirements:

- Keep separate routes for clarity but add a unified legacy-style tab/hub.
- Show next BP/BR number and selected bank balance/projected balance.

## 8. Reports

Original reports are mostly filter-first screens. The clone has many report routes but several are not layout-parity complete.

| Report | Original filters/behavior | Clone gap |
|---|---|---|
| Sale B/W Date | Type, segment, item/brand/date variants; report modes | Clone has flat table, needs modes |
| Cylinder Conversion B/W Date | From/to date | Mostly present |
| One Customer Sale History | Customer plus date filters | Mostly present |
| Stock Report | Item/date filter and stock output | Mostly present, verify original columns |
| Cash Book | Account/date filters, opening/running cash/bank style | Present, verify exact columns |
| Vendor Wise Receiving | Vendor/item/date filters | Present |
| General Ledger | Account/date filters | Present |
| Customer Ledger | Customer/date filters | Present |
| Sale Return Report | Customer/item/date filters | Present |
| Purchase Return Report | Vendor/item/date filters | Present |
| Customer Stock Ledger | Customer/item/date filters | Present |
| Daily Activity Report | From/to form followed by full activity report | Clone only count summary |
| Access Cylinders | Two report variants: customers and own business | Clone only customer cylinder balance style |
| Salewise Profit | From/to profit report | Present but cost logic must be validated |
| Profit loss report | Profit & Loss Statement | Present but month/year layout parity missing |
| Chart Of Account Report | Dedicated account report | Missing sidebar/route parity |
| Group Summary | Group summary report | Missing sidebar/route parity |

Build requirements:

- Implement full Daily Activity Report before polish work.
- Add Sale B/W Date output modes.
- Add Chart Of Account Report and Group Summary routes.
- Add Access Cylinders variants.
- Keep CSV/print improvements across all reports.

## 9. Current Clone Strengths to Preserve

The clone already improves on the original in important areas:

- Modern Next.js app shell.
- Prisma-backed data model.
- RBAC foundation.
- Audit logs.
- Closed-day write guards.
- Reversal workflows.
- CSV/print report pattern.
- Cleaner transaction services and balanced voucher posting.
- Vendor opening balance, trial balance, balance sheet, audit log, stock ledger, and voucher list features beyond the original.

Do not regress these while adding parity fields.

## 10. Main Parity Gaps

Highest-impact gaps:

1. Financial-year selection/switching is not equivalent to original login-year selection.
2. Bank Coding is not exposed under Configuration and lacks original detail fields.
3. Customer, vendor, and bank master records are missing several legacy detail fields.
4. Sale LPG lacks discount/net bill, gas return block, immediate settlement, bank/cheque fields, and live stock/balance previews.
5. Purchase modules lack discount/net payable, immediate settlement, and cash/bank balance preview.
6. Return modules lack original settlement and valued return detail fields.
7. Security Receipt needs qty, stock issued, and settlement parity.
8. Chart of Accounts needs tree view and richer account metadata.
9. Reports need Daily Activity full layout, Sale B/W Date modes, Access Cylinders variants, Chart Of Account Report, and Group Summary.
10. Payment/receipt history and voucher number preview need operator-facing parity.

## 11. Build Sequence

### Phase 0: Stabilize Local Development

- Keep embedded local Postgres runner for Windows environments without Docker.
- Add `dev:db` or documented command for `scripts/start-embedded-postgres.cjs`.
- Keep `.local-postgres/` ignored.
- Ensure seed data includes enough customers, vendors, items, banks, and opening balances to exercise every screen.

### Phase 1: Navigation and Settings Parity

- Add Bank Coding under Configuration.
- Add Chart Of Account Report and Group Summary report routes.
- Add change password route.
- Add financial-year selector/switcher in login or post-login shell.
- Add company settings for stock check, centralized pricing, default date, same-page redirect, working days, and working hours.

Acceptance:

- Sidebar labels match original plus intentional clone-only extras.
- Admin can switch/select active financial year.
- Company settings influence transaction defaults.

### Phase 2: Master Data Parity

- Extend Customer fields: contact person, address 2, segment type, registration date, NTN, GST, credit days.
- Extend Vendor fields: contact person, city/area, tax/company fields, credit days, brand mapping.
- Extend Bank fields: account number, opening balance/type, contact/address fields, status.
- Extend Item UI around security, brand/category/status.
- Add active/inactive filtering to all lookup selects.

Acceptance:

- Original master add forms can be represented without losing fields.
- Existing transaction selects use active records only unless viewing historical entries.

### Phase 3: Shared Settlement Component

Build a reusable settlement model and UI for:

- Pay/receive mode: cash, bank, possibly split.
- Bank selection.
- Cheque/DD number and date.
- Amount received/paid.
- Cash balance and bank balance preview.
- Discount and net payable/net bill.
- Projected balance after transaction.

Use it in:

- Purchase Filled Cylinder.
- Purchase Empty Cylinder.
- Purchase Other.
- Sale LPG.
- Empty Sale.
- Cylinder Return.
- Security Receipt.

Acceptance:

- Posting transaction plus immediate payment/receipt is atomic.
- Vouchers remain balanced.
- Cash/bank ledgers match settlement.

### Phase 4: Sale and Purchase Workflow Parity

- Sale LPG: add customer balance, live filled stock, gas return block, discount/net bill, settlement, Urdu/English print verification.
- Complete Day Sale: add per-item return qty, item stock previews, language, bank/cheque settlement.
- Purchase Filled/Empty/Other: add settlement, discount/net payable, balance preview.
- Empty Sale: add empty stock preview and settlement.

Acceptance:

- Operators can enter the same data shown on original screens.
- Stock, customer/vendor balances, GST, security, and vouchers update in one transaction.
- Print routes show expected document language and totals.

### Phase 5: Returns and Adjustment Workflows

- Cylinder Return: add gas/security amount detail and settlement.
- Purchase Return Cylinder/Other: add stock preview and validate accounting.
- Cylinder Conversion: add live stock previews and original-style line table.
- Decanting Sale: decide parity depth; if retained, model batch/finalize/report workflow.

Acceptance:

- Return screens support original field set.
- Valued returns are controlled and auditable.
- Stock ledgers remain immutable.

### Phase 6: Accounting and Voucher UX

- Add voucher number preview to cash payment, cash receipt, bank payment, bank receipt, journal voucher.
- Add list/history screens for cash/bank payments and receipts if voucher list is not enough for operators.
- Add chart account tree/hierarchy UI.
- Add account metadata fields required by original.

Acceptance:

- Accountant can navigate from dashboard balances to ledger and source voucher.
- Chart of accounts can be managed without losing hierarchy.

### Phase 7: Reports Parity

- Build Daily Activity full report layout.
- Add Sale B/W Date modes.
- Add Access Cylinders customer and own-business variants.
- Add Chart Of Account Report.
- Add Group Summary.
- Improve Profit/Loss month/year layout.
- Validate Cash Book, Stock Report, Customer Ledger, Vendor Ledger against migrated sample data.

Acceptance:

- Every original report route has a clone route.
- Report filters and totals can be checked against the original audit expectations.
- Print and CSV remain available.

### Phase 8: Operational Controls

- Add backup schedule/status reminder instead of static warning.
- Add database restore workflow if required.
- Add day-close cash reconciliation and close report.
- Add reopen approval queue.
- Add audit entries for login/logout and setting changes.

Acceptance:

- The clone preserves original operational controls and adds safer controls where original was weak.

## 12. Data Migration Plan

Required import areas:

- Company settings and working days.
- Users, roles, and user-area mappings.
- Cities, areas, brands, categories, items.
- Customers, vendors, banks, chart accounts.
- Opening balances.
- Stock ledger opening state.
- Historical sale, purchase, return, payment, receipt, bank, journal transactions if available.

Migration rules:

- Preserve original document numbers where possible.
- Use legacy financial year `2020-21` as imported historical year, then create current active year separately.
- Recompute balances from ledgers where possible, but keep legacy balances for reconciliation.
- Mark imported records with source metadata for audit.

## 13. Testing Strategy

Use three levels:

1. Unit/service tests for stock/accounting math.
2. API tests for posting workflows and closed-day guards.
3. Browser UAT scripts for operator flows.

Core end-to-end script:

1. Create or verify customer/vendor/item/bank.
2. Post Purchase Filled Cylinder with empty return and settlement.
3. Post Sale LPG with security, empty return, discount, and receipt.
4. Post Cylinder Return with valued return.
5. Post Cash Receipt and Bank Receipt.
6. Compare Customer Ledger, Stock Report, Cash Book, Daily Activity.
7. Close day and confirm writes are blocked.

## 14. Definition of Done

A module is done when:

- Route exists and is in the correct sidebar group.
- Fields cover original business data or have a documented intentional omission.
- Validations prevent original data-quality problems.
- Save action posts stock/accounting/audit records atomically.
- List/history view can find posted documents.
- Print view exists where original had printable output.
- Report totals can be reconciled from ledger data.
- RBAC and closed-day guards apply.
- UAT checklist row can be marked Full, Improved, or intentionally N/A.

## 15. Immediate Next Sprint

Recommended first sprint:

1. Add Bank Coding sidebar parity and extend bank fields.
2. Add company setting fields that drive transaction behavior.
3. Build shared settlement component/service model.
4. Apply settlement to Sale LPG first.
5. Add Sale LPG live customer balance and stock preview.
6. Add voucher number preview to Sale LPG generated documents.
7. Update UAT checklist for the newly audited missing reports.

Reasoning:

- Sale LPG is the highest-frequency workflow.
- The settlement block is reused by purchase, return, empty sale, and security receipt.
- Bank Coding and company settings unlock multiple downstream screens.
