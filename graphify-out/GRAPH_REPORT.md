# Graph Report - LPG-ERP  (2026-05-30)

## Corpus Check
- 374 files · ~358,760 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1978 nodes · 4791 edges · 120 communities (99 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0b56e936`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]

## God Nodes (most connected - your core abstractions)
1. `serviceError()` - 223 edges
2. `getRequestContext()` - 220 edges
3. `readJson()` - 117 edges
4. `optionalStringField()` - 105 edges
5. `stringField()` - 101 edges
6. `ok()` - 96 edges
7. `Communities` - 79 edges
8. `fail()` - 65 edges
9. `dateField()` - 56 edges
10. `enforcePermission()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `encodePassword()` --calls--> `hashPassword()`  [INFERRED]
  src/app/api/auth/change-password/route.ts → prisma/seed.js
- `encodePassword()` --calls--> `hashPassword()`  [INFERRED]
  src/server/services/user-management/user-management.ts → prisma/seed.js
- `GET()` --calls--> `serviceError()`  [EXTRACTED]
  src/app/api/auth/login-options/route.ts → src/server/api/responses.ts
- `seedFilledStock()` --calls--> `doc()`  [EXTRACTED]
  tests/cylinder-conversion.test.mjs → tests/helpers/lpg-fixtures.mjs
- `seedFilledStock()` --calls--> `doc()`  [EXTRACTED]
  tests/decanting-sale.test.mjs → tests/helpers/lpg-fixtures.mjs

## Communities (120 total, 21 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (70): DOCUMENT_PREFIXES, DocumentNumberInput, formatDocumentNumber(), nextDocumentNumber(), peekNextDocumentNumber(), Tx, createJournalVoucher(), arrayField() (+62 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (79): Communities, Community 0 - "POST()", Community 10 - "tweaks-panel.jsx", Community 11 - "design-canvas.jsx", Community 12 - "day-closing-operations.ts", Community 13 - "phase3d-controls.test.mjs", Community 14 - "seed.js", Community 15 - "erp-sale-day.jsx" (+71 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (50): listJournalVouchers(), GET(), PUT(), getRequestContext(), header(), RequestContext, ok(), serviceError() (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (27): ApiError(), AuditLogViewer(), AuditRow, ACTIONS, BANK_SOURCE_TYPES, TYPE_OPTIONS, VoucherRow, Column (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (48): csvResponse(), GET(), csvResponse(), GET(), csvResponse(), GET(), csvResponse(), GET() (+40 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (35): customerBody(), customerListSelect, mapMasterRow(), optionalStringOrNumberField(), vendorBody(), vendorListSelect, Body, GET() (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (39): AppShellContext, getAppShellContext(), clearSessionCookieValue(), getSessionContextFromCookies(), createSession(), deleteSessionByToken(), getSessionContextFromRequest(), getSessionContextFromToken() (+31 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (28): dateValue(), DayClosingPanel(), Status, FormSection(), CashOpeningManager(), CustomerOpeningBalanceManager(), ShopOpeningBalanceManager(), today() (+20 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (32): amount(), CylinderReturnForm(), emptyLine, lineTotal(), Lookup, money(), ReturnLine, emptyLine() (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (36): GET(), GET(), cashHasTransactions(), CashOpeningInput, Context, createCashOpeningBalance(), createCustomerOpeningBalance(), createShopOpeningBalance() (+28 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (27): fail(), readJson(), stringField(), POST(), POST(), GET(), updateArea(), updateBank() (+19 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (14): cashInData, cashOutData, CUSTOMERS, DAY_CUSTOMERS, DAY_ITEMS, ICONS, ITEMS, LEDGER_ENTRIES (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (18): CylinderConversionForm(), Lookup, optionLabel(), DecantingSaleForm(), Lookup, money(), optionLabel(), FinancialYear (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.08
Nodes (3): display(), PrintableDocument, PrintableTransactionDocument()

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (29): encodePassword(), GET(), PUT(), actions, hashPassword(), main(), modules, prisma (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (22): csvResponse(), GET(), Context, dateWhere(), getOneCustomerSaleHistoryReport(), getOneCustomerSaleHistoryReportCsv(), getSaleBetweenDatesReport(), getSaleBetweenDatesReportCsv() (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (11): BankCodingClient(), Column, emptyValues(), Field, highRiskEndpoints, MasterDataManager(), Option, areaSource (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (15): ACCOUNT_CODES, getAccountIdByCode(), Tx, capDiscount(), AuditInput, Tx, PurchaseFilledCylinderInput, PurchaseFilledCylinderLineInput (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.11
Nodes (22): BACKUP_DIR, BackupFile, checkPermission(), Context, ensureBackupDir(), getBackupDownloadPath(), isPgDumpAvailable(), listBackupFiles() (+14 more)

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (17): accountBalance(), Context, getSettlementBalancePreview(), signedBalance(), cleanEmail(), CompanyInformationInput, Context, getCompanyInformation() (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (28): dependencies, next, @prisma/client, react, react-dom, description, devDependencies, embedded-postgres (+20 more)

### Community 22 - "Community 22"
Cohesion: 0.12
Nodes (15): Account, ACCOUNT_TYPES_FOR_PAYMENT, Bank, CONFIG, emptyLine(), money(), MultiLinePaymentForm(), PaymentLine (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (24): getBankAccountId(), getCashAccountId(), nextDocumentNumberInTransaction(), decimal(), postCustomerReceipt(), postCustomerRefund(), postVendorPayment(), SettlementPaymentInput (+16 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (18): doc(), createBankAccount(), createOffsetAccount(), createVoucher(), prisma, fixture(), prisma, createAccountingMovement() (+10 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (15): csvResponse(), GET(), dateOnly(), parseReportFilters(), Context, getPurchaseReturnReport(), getPurchaseReturnReportCsv(), getVendorWiseReceivingReport() (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (13): createIsolatedCustomer(), createIsolatedVendor(), isolatedFixture(), authedGetRequest(), authedJsonRequest(), fixture(), prisma, baseFixture() (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (15): activeAdminRoleCount(), assertSafeAdminChange(), Context, createRole(), getRole(), listAssignableUsers(), listRoles(), rbacPermissionId() (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.11
Nodes (10): CylinderConversionInput, createStockLedgerEntry(), StockLedgerInput, Tx, BasePurchaseInput, PurchaseEmptyCylinderInput, PurchaseEmptyCylinderLineInput, PurchaseOtherInput (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (14): asDecimal(), assertReversalPolicy(), assertSupported(), configs, Context, createCompensatingReversal(), createReversalStub(), createReversalVoucher() (+6 more)

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (12): bankPayment(), bankReceipt(), BasePaymentInput, cashPayment(), cashReceipt(), multiLineBankPayment(), multiLineBankReceipt(), multiLineCashPayment() (+4 more)

### Community 32 - "Community 32"
Cohesion: 0.19
Nodes (12): csvResponse(), GET(), csvResponse(), GET(), Context, getChartOfAccountReport(), getChartOfAccountReportCsv(), getGroupSummaryReport() (+4 more)

### Community 33 - "Community 33"
Cohesion: 0.19
Nodes (12): csvResponse(), GET(), csvResponse(), GET(), Context, getCustomerStockLedgerReport(), getCustomerStockLedgerReportCsv(), getCylinderConversionReport() (+4 more)

### Community 34 - "Community 34"
Cohesion: 0.14
Nodes (15): DayClosingTrailStatus, getDayClosingTrailStatus(), GuardInput, addDay(), closeBusinessDay(), Context, dateOnly(), findClosingForReopen() (+7 more)

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (10): csvResponse(), Context, getCustomerCylinderBalanceReport(), getCustomerCylinderBalanceReportCsv(), getStockSummaryReport(), getStockSummaryReportCsv(), toCsv(), GET() (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.12
Nodes (15): 1. Navigation Inventory, 2. Screen Inventory, 3. Transaction Modules Implemented, 4. Reports Inventory, 5. Accounting Inventory, 6. Operational Controls, 7. UI Structure, 8. Known Gaps (+7 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (9): emptyLine(), lineBaseAmount(), lineTotals(), Lookup, money(), numberValue(), PurchaseReturnForm(), ReturnKind (+1 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (9): amount(), BatchSaleForm(), emptyRow, emptySlot, ItemSlot, Lookup, money(), Row (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (10): BankRow, DashboardClient(), DashboardData, fmt(), KPI_DEFS, KpiData, KpiIconName, QUICK_LINKS (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.16
Nodes (5): cleanup, createTestItem(), createTestVendor(), doc(), prisma

### Community 42 - "Community 42"
Cohesion: 0.15
Nodes (12): files, code, document, image, paper, video, graphifyignore_patterns, needs_graph (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.17
Nodes (6): CompanyInfo, CompanyInformationForm(), days, defaultWorkingDays, FormValues, WorkingDays

### Community 44 - "Community 44"
Cohesion: 0.15
Nodes (7): BasePurchaseReturnInput, purchaseReturnCylinder(), PurchaseReturnCylinderInput, PurchaseReturnCylinderLineInput, purchaseReturnOther(), PurchaseReturnOtherInput, PurchaseReturnOtherLineInput

### Community 45 - "Community 45"
Cohesion: 0.21
Nodes (7): cleanup, createTestCustomer(), createTestItem(), doc(), prisma, source(), vno()

### Community 47 - "Community 47"
Cohesion: 0.17
Nodes (11): 10. Main Parity Gaps, 12. Data Migration Plan, 13. Testing Strategy, 14. Definition of Done, 15. Immediate Next Sprint, 1. Audit Coverage, 2. Original Navigation Map, 3. Original Shell and Dashboard (+3 more)

### Community 48 - "Community 48"
Cohesion: 0.17
Nodes (11): 0. Authentication & shell, 1. Configuration, 2. Sale / Purchase, 3. Returns, 4. Payment / Receipt, 5. Reports, 6. Database & admin (clone-only extras), 7. End-to-end day script (recommended) (+3 more)

### Community 49 - "Community 49"
Cohesion: 0.24
Nodes (9): cleanup, createCustomer(), createItem(), createPurchaseEntry(), createSaleEntry(), doc(), prisma, src() (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.18
Nodes (10): Architecture, Auth And RBAC, Current Local Caveats, Database, Development Constraints, Domain Rules, LPG ERP Architecture Decisions, Product Identity (+2 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (11): 4. Configuration Modules, Bank Coding, City, Area, Brand, Category, Company Information, Customer Coding, Day Closing, Expense Type Coding, Item Coding (+3 more)

### Community 52 - "Community 52"
Cohesion: 0.18
Nodes (10): Concrete next sprint, Notes for the next developer, P0 - Verify and harden completed flows, P1 - Finish configuration and master parity, P2 - Shell, dashboard, and operator ergonomics, P3 - Reports and print parity, P4 - Accounting and operations depth, Remaining gaps by priority (+2 more)

### Community 53 - "Community 53"
Cohesion: 0.24
Nodes (7): blankLine, EmptySaleForm(), EmptySaleLine, lineTotals(), Lookup, money(), numberValue()

### Community 54 - "Community 54"
Cohesion: 0.25
Nodes (6): money(), MonthlyGrid(), PlRow, ProfitLossReport, ProfitLossReportClient(), StatementSection()

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (6): baseFixture(), fixture(), prisma, createExpenseAccount(), fixture(), prisma

### Community 56 - "Community 56"
Cohesion: 0.24
Nodes (6): cleanup, createReportItem(), doc(), prisma, source(), voucherNo()

### Community 58 - "Community 58"
Cohesion: 0.20
Nodes (10): 11. Build Sequence, Phase 0: Stabilize Local Development, Phase 1: Navigation and Settings Parity, Phase 2: Master Data Parity, Phase 3: Shared Settlement Component, Phase 4: Sale and Purchase Workflow Parity, Phase 5: Returns and Adjustment Workflows, Phase 6: Accounting and Voucher UX (+2 more)

### Community 59 - "Community 59"
Cohesion: 0.20
Nodes (9): Current milestone, Original ERP Parity Roadmap, P0 — Operator-critical, P1 — Masters & configuration, P2 — Dashboard & shell, P3 — Reports, P4 — Accounting depth, Status legend (+1 more)

### Community 60 - "Community 60"
Cohesion: 0.24
Nodes (7): Context, CreateJournalVoucherInput, JvLineInput, assertBalancedVoucher(), CreateVoucherInput, Tx, VoucherLineInput

### Community 61 - "Community 61"
Cohesion: 0.31
Nodes (8): GET(), POST(), GET(), POST(), createArea(), createCity(), listAreas(), listCities()

### Community 62 - "Community 62"
Cohesion: 0.33
Nodes (8): authedGet(), createAccount(), createVoucher(), csvFrom(), doc(), isolatedFinancialYear(), prisma, voucherNo()

### Community 63 - "Community 63"
Cohesion: 0.24
Nodes (5): cleanup, createTestCustomer(), createTestItem(), doc(), prisma

### Community 64 - "Community 64"
Cohesion: 0.22
Nodes (8): Development Workflow, Inspect Before Editing, Keep Scope Small, Preserve Domain Boundaries, Report Clearly, Start With Locked Decisions, Target Files Efficiently, Validate Appropriately

### Community 65 - "Community 65"
Cohesion: 0.22
Nodes (9): 5. Sale/Purchase Workflows, Complete Day Sale, Cylinder Conversion, Decanting Sale, Empty Sale, Purchase Empty Cylinder, Purchase Filled Cylinder, Purchase Other (+1 more)

### Community 66 - "Community 66"
Cohesion: 0.22
Nodes (8): Community Hubs (Navigation), Corpus Check, God Nodes (most connected - your core abstractions), Graph Report - F:\LPG ERP  (2026-05-07), Knowledge Gaps, Suggested Questions, Summary, Surprising Connections (you probably didn't know these)

### Community 67 - "Community 67"
Cohesion: 0.28
Nodes (5): Account, emptyLine(), JournalVoucherPage(), JvLine, VoucherRow

### Community 68 - "Community 68"
Cohesion: 0.32
Nodes (5): assertFilledStockAvailable(), getFilledStockByItem(), Tx, Context, getSaleLpgContext()

### Community 69 - "Community 69"
Cohesion: 0.39
Nodes (7): auditObject(), dateText(), DocumentConfig, documentConfigs, GET(), isDocumentType(), money()

### Community 70 - "Community 70"
Cohesion: 0.29
Nodes (5): createIsolatedItem(), fixture(), grant(), prisma, seedFilledStock()

### Community 71 - "Community 71"
Cohesion: 0.29
Nodes (4): cleanup, doc(), prisma, withJvPermission()

### Community 72 - "Community 72"
Cohesion: 0.25
Nodes (3): cashInData, cashOutData, salesData

### Community 73 - "Community 73"
Cohesion: 0.29
Nodes (6): capturedAt, entryFormAudit, navigation, note, sidebarRouteAudit, source

### Community 74 - "Community 74"
Cohesion: 0.29
Nodes (7): 7. Payment/Receipt and Accounting, Bank Payments / Receipt, Cash Payment, Cash Receipt, Chart of Accounts, Journal Vouchers, Security Receipt

### Community 75 - "Community 75"
Cohesion: 0.29
Nodes (6): directed, graph, hyperedges, links, multigraph, nodes

### Community 76 - "Community 76"
Cohesion: 0.33
Nodes (4): fixture(), grant(), prisma, seedFilledStock()

### Community 77 - "Community 77"
Cohesion: 0.33
Nodes (4): fixture(), grant(), prisma, seedEmptyStock()

### Community 78 - "Community 78"
Cohesion: 0.33
Nodes (4): authedJsonRequest(), createSaleDocument(), prisma, root

### Community 79 - "Community 79"
Cohesion: 0.38
Nodes (4): createAccount(), createVoucher(), doc(), prisma

### Community 80 - "Community 80"
Cohesion: 0.33
Nodes (5): Assumptions, Folder Structure, Migration Risks, Phase 1 Foundation, Scope

### Community 81 - "Community 81"
Cohesion: 0.33
Nodes (5): edges, hyperedges, input_tokens, nodes, output_tokens

### Community 82 - "Community 82"
Cohesion: 0.40
Nodes (3): Area, MapAreaClient(), UserInfo

### Community 83 - "Community 83"
Cohesion: 0.40
Nodes (4): auditEntityIds, doc(), fixture(), prisma

### Community 84 - "Community 84"
Cohesion: 0.47
Nodes (4): doc(), grantPermission(), isolatedDayClosingFixture(), prisma

### Community 85 - "Community 85"
Cohesion: 0.40
Nodes (3): doc(), isolatedAdminFixture(), prisma

### Community 86 - "Community 86"
Cohesion: 0.40
Nodes (4): edges, input_tokens, nodes, output_tokens

### Community 87 - "Community 87"
Cohesion: 0.80
Nodes (4): csvResponse(), GET(), getDailyActivityReport(), getDailyActivityReportCsv()

### Community 88 - "Community 88"
Cohesion: 0.50
Nodes (3): fixture(), grant(), prisma

### Community 94 - "Community 94"
Cohesion: 0.50
Nodes (4): 6. Return Workflows, Cylinder Return, Purchase Return Cylinder, Purchase Return Other

### Community 96 - "Community 96"
Cohesion: 0.67
Nodes (3): authedRequest(), fixture(), prisma

## Knowledge Gaps
- **553 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `description` (+548 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PageHeader()` connect `Community 3` to `Community 67`, `Community 37`, `Community 6`, `Community 39`, `Community 7`, `Community 8`, `Community 43`, `Community 13`, `Community 17`, `Community 82`, `Community 53`, `Community 22`, `Community 54`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `serviceError()` connect `Community 2` to `Community 0`, `Community 32`, `Community 33`, `Community 35`, `Community 4`, `Community 5`, `Community 69`, `Community 6`, `Community 9`, `Community 11`, `Community 15`, `Community 16`, `Community 19`, `Community 87`, `Community 25`, `Community 28`, `Community 61`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `getRequestContext()` connect `Community 2` to `Community 0`, `Community 32`, `Community 33`, `Community 35`, `Community 4`, `Community 5`, `Community 6`, `Community 69`, `Community 9`, `Community 11`, `Community 15`, `Community 16`, `Community 19`, `Community 87`, `Community 25`, `Community 28`, `Community 61`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `nextConfig`, `name`, `version` to the rest of the system?**
  _553 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0895843287147635 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.02531645569620253 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08771929824561403 - nodes in this community are weakly interconnected._