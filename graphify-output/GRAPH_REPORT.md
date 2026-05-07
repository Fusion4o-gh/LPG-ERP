# Graph Report - F:\LPG ERP  (2026-05-07)

## Corpus Check
- 157 files · ~72,938 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 494 nodes · 743 edges · 78 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_POST()|POST()]]
- [[_COMMUNITY_reversal-policy.ts|reversal-policy.ts]]
- [[_COMMUNITY_ERP Reverse Engineering Report|# ERP Reverse Engineering Report]]
- [[_COMMUNITY__combined_components.jsx|_combined_components.jsx]]
- [[_COMMUNITY_apiPost()|apiPost()]]
- [[_COMMUNITY_master-data.ts|master-data.ts]]
- [[_COMMUNITY_role-management.ts|role-management.ts]]
- [[_COMMUNITY_session.ts|session.ts]]
- [[_COMMUNITY_erp-primitives.jsx|erp-primitives.jsx]]
- [[_COMMUNITY_createSession()|createSession()]]
- [[_COMMUNITY_tweaks-panel.jsx|tweaks-panel.jsx]]
- [[_COMMUNITY_design-canvas.jsx|design-canvas.jsx]]
- [[_COMMUNITY_day-closing-operations.ts|day-closing-operations.ts]]
- [[_COMMUNITY_phase3d-controls.test.mjs|phase3d-controls.test.mjs]]
- [[_COMMUNITY_seed.js|seed.js]]
- [[_COMMUNITY_erp-sale-day.jsx|erp-sale-day.jsx]]
- [[_COMMUNITY_erp-sale-new.jsx|erp-sale-new.jsx]]
- [[_COMMUNITY_erp-settings.jsx|erp-settings.jsx]]
- [[_COMMUNITY_erp-shell.jsx|erp-shell.jsx]]
- [[_COMMUNITY_service-layer.test.mjs|service-layer.test.mjs]]
- [[_COMMUNITY_ui-phase3b.test.mjs|ui-phase3b.test.mjs]]
- [[_COMMUNITY_api-response.ts|api-response.ts]]
- [[_COMMUNITY_StockLedgerPageClient.tsx|StockLedgerPageClient.tsx]]
- [[_COMMUNITY_load()|load()]]
- [[_COMMUNITY_CustomerLedgerScreen()|CustomerLedgerScreen()]]
- [[_COMMUNITY_SaleListScreen()|SaleListScreen()]]
- [[_COMMUNITY_schema()|schema()]]
- [[_COMMUNITY_RootLayout()|RootLayout()]]
- [[_COMMUNITY_RootPage()|RootPage()]]
- [[_COMMUNITY_LoginPage()|LoginPage()]]
- [[_COMMUNITY_CompanySetupPage()|CompanySetupPage()]]
- [[_COMMUNITY_FinancialYearsPage()|FinancialYearsPage()]]
- [[_COMMUNITY_CustomersPage()|CustomersPage()]]
- [[_COMMUNITY_VendorsPage()|VendorsPage()]]
- [[_COMMUNITY_ItemsPage()|ItemsPage()]]
- [[_COMMUNITY_ChartOfAccountsPage()|ChartOfAccountsPage()]]
- [[_COMMUNITY_VouchersPage()|VouchersPage()]]
- [[_COMMUNITY_VoucherDetailPage()|VoucherDetailPage()]]
- [[_COMMUNITY_StockLedgerPage()|StockLedgerPage()]]
- [[_COMMUNITY_AuditLogPage()|AuditLogPage()]]
- [[_COMMUNITY_BanksPage()|BanksPage()]]
- [[_COMMUNITY_ReportsPage()|ReportsPage()]]
- [[_COMMUNITY_PurchaseFilledCylinderPage()|PurchaseFilledCylinderPage()]]
- [[_COMMUNITY_SaleLpgPage()|SaleLpgPage()]]
- [[_COMMUNITY_CompleteDaySalePage()|CompleteDaySalePage()]]
- [[_COMMUNITY_CylinderReturnPage()|CylinderReturnPage()]]
- [[_COMMUNITY_DayClosingPage()|DayClosingPage()]]
- [[_COMMUNITY_ReversalsPage()|ReversalsPage()]]
- [[_COMMUNITY_CashReceiptPage()|CashReceiptPage()]]
- [[_COMMUNITY_CashPaymentPage()|CashPaymentPage()]]
- [[_COMMUNITY_BankReceiptPage()|BankReceiptPage()]]
- [[_COMMUNITY_BankPaymentPage()|BankPaymentPage()]]
- [[_COMMUNITY_SecurityReceiptPage()|SecurityReceiptPage()]]
- [[_COMMUNITY_userCan()|userCan()]]
- [[_COMMUNITY_writeAuditLog()|writeAuditLog()]]
- [[_COMMUNITY_assertBalancedVoucher()|assertBalancedVoucher()]]
- [[_COMMUNITY_ApiError()|ApiError()]]
- [[_COMMUNITY_SuccessMessage.tsx|SuccessMessage.tsx]]
- [[_COMMUNITY_SubmitButton.tsx|SubmitButton.tsx]]
- [[_COMMUNITY_PageHeader()|PageHeader()]]
- [[_COMMUNITY_FormSection()|FormSection()]]
- [[_COMMUNITY_AppShell()|AppShell()]]
- [[_COMMUNITY_EntityList()|EntityList()]]
- [[_COMMUNITY_LoginForm()|LoginForm()]]
- [[_COMMUNITY_LogoutButton()|LogoutButton()]]
- [[_COMMUNITY_VoucherListPageClient.tsx|VoucherListPageClient.tsx]]
- [[_COMMUNITY_VoucherDetailPageClient.tsx|VoucherDetailPageClient.tsx]]
- [[_COMMUNITY_normalizeReadlinkError()|normalizeReadlinkError()]]
- [[_COMMUNITY_next.config.ts|next.config.ts]]
- [[_COMMUNITY_next-env.d.ts|next-env.d.ts]]
- [[_COMMUNITY_postcss.config.mjs|postcss.config.mjs]]
- [[_COMMUNITY_tailwind.config.ts|tailwind.config.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_DataTable.tsx|DataTable.tsx]]
- [[_COMMUNITY_Sidebar.tsx|Sidebar.tsx]]
- [[_COMMUNITY_Customer Cylinder Balance|Customer Cylinder Balance]]
- [[_COMMUNITY_LPG ERP – Wireframes|LPG ERP – Wireframes]]

## God Nodes (most connected - your core abstractions)
1. `POST()` - 59 edges
2. `GET()` - 38 edges
3. `PUT()` - 21 edges
4. `# ERP Reverse Engineering Report` - 20 edges
5. `architecture-decisions` - 16 edges
6. `phase-1-foundation` - 13 edges
7. `apiPost()` - 7 edges
8. `getRequestContext()` - 7 edges
9. `createSaleInTransaction()` - 6 edges
10. `ok()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `assertReversalAudit()` --calls--> `ok()`  [INFERRED]
  tests\reversal-services.test.mjs → src\server\api\responses.ts
- `GET()` --calls--> `listPermissions()`  [INFERRED]
  src\app\api\day-closing\route.ts → src\server\services\rbac\role-management.ts
- `GET()` --calls--> `listRoles()`  [INFERRED]
  src\app\api\day-closing\route.ts → src\server\services\rbac\role-management.ts
- `GET()` --calls--> `listAssignableUsers()`  [INFERRED]
  src\app\api\day-closing\route.ts → src\server\services\rbac\role-management.ts
- `GET()` --calls--> `getRole()`  [INFERRED]
  src\app\api\day-closing\route.ts → src\server\services\rbac\role-management.ts

## Communities

### Community 0 - "POST()"
Cohesion: 0.07
Nodes (30): readAuditLogs(), formatDocumentNumber(), nextDocumentNumber(), nextDocumentNumberInTransaction(), bankPayment(), bankReceipt(), cashPayment(), cashReceipt() (+22 more)

### Community 1 - "reversal-policy.ts"
Cohesion: 0.07
Nodes (27): getAccountIdByCode(), getCashAccountId(), writeAuditLog(), update(), cylinderReturn(), assertWritableBusinessDate(), getDayClosingTrailStatus(), trailStatusFromAuditValue() (+19 more)

### Community 2 - "# ERP Reverse Engineering Report"
Cohesion: 0.05
Nodes (44): Architecture, Auth And RBAC, Current Local Caveats, Database, Development Constraints, Domain Rules, LPG ERP Architecture Decisions, Product Identity (+36 more)

### Community 3 - "_combined_components.jsx"
Cohesion: 0.05
Nodes (6): BarChart(), BarChart(), assertReversalAudit(), doc(), fixture(), reverse()

### Community 4 - "apiPost()"
Cohesion: 0.1
Nodes (19): apiGet(), apiPost(), apiPut(), parseResponse(), closeDay(), dateValue(), load(), reopen() (+11 more)

### Community 5 - "master-data.ts"
Cohesion: 0.11
Nodes (10): createBank(), createChartAccount(), createCustomer(), createItem(), createVendor(), updateBank(), updateChartAccount(), updateCustomer() (+2 more)

### Community 6 - "role-management.ts"
Cohesion: 0.16
Nodes (12): activeAdminRoleCount(), assertSafeAdminChange(), createRole(), getRole(), listAssignableUsers(), listPermissions(), listRoles(), rbacPermissionId() (+4 more)

### Community 7 - "session.ts"
Cohesion: 0.13
Nodes (10): ProtectedLayout(), RolesPage(), canAccess(), clearSessionCookieValue(), getSessionContextFromCookies(), deleteSessionByToken(), getSessionContextFromToken(), readTokenFromRequest() (+2 more)

### Community 8 - "erp-primitives.jsx"
Cohesion: 0.14
Nodes (0): 

### Community 9 - "createSession()"
Cohesion: 0.2
Nodes (9): authedGetRequest(), authedJsonRequest(), fixture(), authedRequest(), fixture(), authedGet(), doc(), isolatedAdminFixture() (+1 more)

### Community 10 - "tweaks-panel.jsx"
Cohesion: 0.15
Nodes (0): 

### Community 11 - "design-canvas.jsx"
Cohesion: 0.22
Nodes (0): 

### Community 12 - "day-closing-operations.ts"
Cohesion: 0.28
Nodes (7): addDay(), closeBusinessDay(), dateOnly(), findClosingForReopen(), getDayClosingStatus(), reopenBusinessDay(), requestDayReopen()

### Community 13 - "phase3d-controls.test.mjs"
Cohesion: 0.6
Nodes (3): doc(), grantPermission(), isolatedDayClosingFixture()

### Community 14 - "seed.js"
Cohesion: 0.83
Nodes (3): hashPassword(), main(), upsertAccount()

### Community 15 - "erp-sale-day.jsx"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "erp-sale-new.jsx"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "erp-settings.jsx"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "erp-shell.jsx"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "service-layer.test.mjs"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "ui-phase3b.test.mjs"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "api-response.ts"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "StockLedgerPageClient.tsx"
Cohesion: 1.0
Nodes (2): load(), submit()

### Community 23 - "load()"
Cohesion: 1.0
Nodes (2): load(), submit()

### Community 24 - "CustomerLedgerScreen()"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "SaleListScreen()"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "schema()"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "RootLayout()"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "RootPage()"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "LoginPage()"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "CompanySetupPage()"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "FinancialYearsPage()"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "CustomersPage()"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "VendorsPage()"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "ItemsPage()"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "ChartOfAccountsPage()"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "VouchersPage()"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "VoucherDetailPage()"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "StockLedgerPage()"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "AuditLogPage()"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "BanksPage()"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "ReportsPage()"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "PurchaseFilledCylinderPage()"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "SaleLpgPage()"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "CompleteDaySalePage()"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "CylinderReturnPage()"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "DayClosingPage()"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "ReversalsPage()"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "CashReceiptPage()"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "CashPaymentPage()"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "BankReceiptPage()"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "BankPaymentPage()"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "SecurityReceiptPage()"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "userCan()"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "writeAuditLog()"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "assertBalancedVoucher()"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "ApiError()"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "SuccessMessage.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "SubmitButton.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "PageHeader()"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "FormSection()"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "AppShell()"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "EntityList()"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "LoginForm()"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "LogoutButton()"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "VoucherListPageClient.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "VoucherDetailPageClient.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "normalizeReadlinkError()"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "next.config.ts"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "next-env.d.ts"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "postcss.config.mjs"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "tailwind.config.ts"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "page.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "page.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "DataTable.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Sidebar.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Customer Cylinder Balance"
Cohesion: 1.0
Nodes (1): Customer Cylinder Balance

### Community 77 - "LPG ERP – Wireframes"
Cohesion: 1.0
Nodes (1): LPG ERP – Wireframes

## Knowledge Gaps
- **33 isolated node(s):** `ERP Reverse Engineering Report`, `Hasnan Traders LPG Distribution ERP — Full Rebuild Plan for Codex`, `1. Executive Summary`, `2. System Map`, `2.1 Identity` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `CustomerLedgerScreen()`** (2 nodes): `CustomerLedgerScreen()`, `erp-ledger.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SaleListScreen()`** (2 nodes): `SaleListScreen()`, `erp-sale-list.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `schema()`** (2 nodes): `schema()`, `schema-foundation.test.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `RootLayout()`** (2 nodes): `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `RootPage()`** (2 nodes): `RootPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `LoginPage()`** (2 nodes): `LoginPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CompanySetupPage()`** (2 nodes): `CompanySetupPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `FinancialYearsPage()`** (2 nodes): `FinancialYearsPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CustomersPage()`** (2 nodes): `CustomersPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `VendorsPage()`** (2 nodes): `VendorsPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ItemsPage()`** (2 nodes): `ItemsPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ChartOfAccountsPage()`** (2 nodes): `ChartOfAccountsPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `VouchersPage()`** (2 nodes): `VouchersPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `VoucherDetailPage()`** (2 nodes): `VoucherDetailPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `StockLedgerPage()`** (2 nodes): `StockLedgerPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AuditLogPage()`** (2 nodes): `AuditLogPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `BanksPage()`** (2 nodes): `BanksPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ReportsPage()`** (2 nodes): `ReportsPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PurchaseFilledCylinderPage()`** (2 nodes): `PurchaseFilledCylinderPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SaleLpgPage()`** (2 nodes): `SaleLpgPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CompleteDaySalePage()`** (2 nodes): `CompleteDaySalePage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CylinderReturnPage()`** (2 nodes): `CylinderReturnPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DayClosingPage()`** (2 nodes): `DayClosingPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ReversalsPage()`** (2 nodes): `ReversalsPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CashReceiptPage()`** (2 nodes): `CashReceiptPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CashPaymentPage()`** (2 nodes): `CashPaymentPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `BankReceiptPage()`** (2 nodes): `BankReceiptPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `BankPaymentPage()`** (2 nodes): `BankPaymentPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SecurityReceiptPage()`** (2 nodes): `SecurityReceiptPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `userCan()`** (2 nodes): `userCan()`, `rbac.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `writeAuditLog()`** (2 nodes): `writeAuditLog()`, `audit.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `assertBalancedVoucher()`** (2 nodes): `assertBalancedVoucher()`, `accounting.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ApiError()`** (2 nodes): `ApiError()`, `ApiError.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SuccessMessage.tsx`** (2 nodes): `SuccessMessage.tsx`, `SuccessMessage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `SubmitButton.tsx`** (2 nodes): `SubmitButton.tsx`, `SubmitButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PageHeader()`** (2 nodes): `PageHeader()`, `PageHeader.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `FormSection()`** (2 nodes): `FormSection()`, `FormSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AppShell()`** (2 nodes): `AppShell()`, `AppShell.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `EntityList()`** (2 nodes): `EntityList()`, `EntityList.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `LoginForm()`** (2 nodes): `LoginForm()`, `LoginForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `LogoutButton()`** (2 nodes): `LogoutButton()`, `LogoutButton.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `VoucherListPageClient.tsx`** (2 nodes): `VoucherListPageClient.tsx`, `VoucherListPageClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `VoucherDetailPageClient.tsx`** (2 nodes): `VoucherDetailPageClient.tsx`, `VoucherDetailPageClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `normalizeReadlinkError()`** (2 nodes): `normalizeReadlinkError()`, `patch-exfat-readlink.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `next.config.ts`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `next-env.d.ts`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `postcss.config.mjs`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `tailwind.config.ts`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `page.tsx`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `page.tsx`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `DataTable.tsx`** (1 nodes): `DataTable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sidebar.tsx`** (1 nodes): `Sidebar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Customer Cylinder Balance`** (1 nodes): `Customer Cylinder Balance`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `LPG ERP – Wireframes`** (1 nodes): `LPG ERP – Wireframes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `POST()` connect `POST()` to `reversal-policy.ts`, `master-data.ts`, `role-management.ts`, `session.ts`, `createSession()`, `day-closing-operations.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `reverse()` connect `_combined_components.jsx` to `reversal-policy.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `createCompensatingReversal()` connect `reversal-policy.ts` to `_combined_components.jsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 38 inferred relationships involving `POST()` (e.g. with `getRequestContext()` and `readJson()`) actually correct?**
  _`POST()` has 38 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `GET()` (e.g. with `getRequestContext()` and `ok()`) actually correct?**
  _`GET()` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `PUT()` (e.g. with `getRequestContext()` and `readJson()`) actually correct?**
  _`PUT()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ERP Reverse Engineering Report`, `Hasnan Traders LPG Distribution ERP — Full Rebuild Plan for Codex`, `1. Executive Summary` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._