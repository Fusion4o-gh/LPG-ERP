# Phase 1 Foundation

## Folder Structure

```text
F:\LPG ERP
├── prisma
│   ├── schema.prisma
│   └── seed.js
├── src
│   ├── app
│   │   ├── (auth)/login/page.tsx
│   │   ├── (protected)
│   │   │   ├── accounting/chart-of-accounts/page.tsx
│   │   │   ├── audit-log/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── masters/customers/page.tsx
│   │   │   ├── masters/items/page.tsx
│   │   │   ├── masters/vendors/page.tsx
│   │   │   └── stock-ledger/page.tsx
│   │   ├── (setup)
│   │   │   ├── company/page.tsx
│   │   │   └── financial-years/page.tsx
│   │   └── api
│   │       ├── accounting/chart-of-accounts/route.ts
│   │       ├── accounting/vouchers/route.ts
│   │       ├── audit-logs/route.ts
│   │       ├── health/route.ts
│   │       ├── masters/customers/route.ts
│   │       ├── masters/items/route.ts
│   │       ├── masters/vendors/route.ts
│   │       ├── setup/status/route.ts
│   │       └── stock-ledger/route.ts
│   └── lib
│       ├── accounting.ts
│       ├── api-response.ts
│       ├── audit.ts
│       ├── prisma.ts
│       └── rbac.ts
└── tests
    └── schema-foundation.test.mjs
```

## Scope

Phase 1 creates foundation only. Frontend route files intentionally return `null`; UI screens will start after schema, auth, RBAC, financial year, ledger, voucher, and audit foundations are agreed.

## Assumptions

Hasnan Traders is modeled as single-tenant in operation, but most operational tables include `companyId` so future branch/company separation does not require destructive rewrites.

Financial years are explicit and closeable. The legacy system is stuck at 2020-21, so historical imports must map each old transaction into a real financial year before reports are trusted.

Cylinder accountability is separate from cash accounting. Customers can owe money and empties at same time; `CustomerCylinderBalance` stores current balance, while `StockLedgerEntry` stores immutable movement history.

Accounting voucher balance is enforced in service code first through `assertBalancedVoucher`. PostgreSQL trigger/check enforcement should be added with the first migration that writes vouchers.

Audit logging has a table and helper, but automatic create/update/delete capture must be wired into server actions/API mutations when transaction modules are implemented.

## Migration Risks

Legacy day closing is stale since 2023-03-29. Opening balances for cash, bank, stock, customers, vendors, and cylinder balances need a signed cutover date.

Old voucher numbers and issue/return numbers must be preserved as external document numbers. New IDs should remain internal UUID/CUID values.

GST amounts, security deposits, and 11.8 KG global pricing overrides should be imported as stored historical values, not recalculated blindly.

Unused modules in legacy ERP should not be treated as required Phase 1 behavior. They should stay modeled only where they affect shared ledgers or migration integrity.

Customer ledger migration must reconcile cash ledger and cylinder ledger separately. A money-balanced customer can still owe empties.
