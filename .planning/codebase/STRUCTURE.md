# Codebase Structure

**Analysis Date:** 2026-06-25

## Directory Layout

```
LPG-ERP/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout (html, theme hydrator)
│   │   ├── (auth)/               # Public auth routes (login)
│   │   ├── (setup)/              # First-run setup (company, financial-years)
│   │   ├── (protected)/          # Authenticated app (guarded by layout.tsx)
│   │   │   ├── layout.tsx        # Session guard + AppShell
│   │   │   ├── dashboard/        # Domain page folders, each with page.tsx
│   │   │   ├── operations/  sale-purchase/  payments/  returns/
│   │   │   ├── accounting/  reports/  masters/  configuration/  settings/
│   │   │   └── .../print/[documentNo]/  # Printable document routes
│   │   └── api/                  # Route handlers (route.ts per endpoint)
│   │       ├── auth/  context/  setup/  health/
│   │       ├── sales/  purchases/  sale-purchase/  returns/  reversals/
│   │       ├── payments/  accounting/  chart-of-accounts/  day-closing/
│   │       ├── masters/  customers/  vendors/  items/  banks/
│   │       ├── configuration/    # ~20 CRUD resource subfolders + [id]
│   │       ├── reports/          # ~20 read-only report endpoints
│   │       └── rbac/  audit-logs/  documents/  transaction-documents/
│   ├── components/               # All client (.tsx) UI: forms, lists, shell
│   ├── lib/                      # Client/shared utils (prisma, api-client, theme)
│   │   └── navigation/modules.ts # Module + route registry for nav
│   └── server/                   # Server-only code (never imported by client)
│       ├── api/                  # Handler helpers (validation, responses, ctx)
│       ├── auth/                 # Sessions, password, app-shell context
│       └── services/<domain>/    # Domain business logic
├── prisma/                       # schema.prisma, migrations, seed.js
├── scripts/                      # DB prep, build patches
├── tests/                        # *.test.mjs + helpers
├── public/                       # Static assets
├── docs/  Wireframe/             # Documentation, design references
├── package.json  tsconfig.json  next.config.ts  tailwind.config.ts
├── Dockerfile  docker-compose.yml  vercel.json
└── .planning/                    # GSD planning + this codebase map
```

## Directory Purposes

**`src/app`:**
- Purpose: Routing, pages, API endpoints (App Router).
- Contains: `layout.tsx`, `page.tsx`, `api/**/route.ts`.
- Key files: `src/app/layout.tsx`, `src/app/(protected)/layout.tsx`.

**`src/components`:**
- Purpose: All interactive client UI (flat directory, no subfolders).
- Contains: `*Form.tsx`, `*List.tsx`, shell (`AppShell`, `Sidebar`, `Topbar`, `ModuleTabBar`), shared primitives (`DataTable`, `PageHeader`, `SubmitButton`).

**`src/lib`:**
- Purpose: Shared/client-safe utilities.
- Key files: `prisma.ts` (DB singleton), `api-client.ts` (fetch wrapper), `theme.ts`, `accounting.ts`, `settlement.ts`, `permissions.ts`, `rbac.ts`, `navigation/modules.ts`.

**`src/server`:**
- Purpose: Server-only logic; not importable from client components.
- Subdirs: `api` (helpers), `auth`, `services/<domain>` (16 domains).

**`prisma`:**
- Purpose: Data model, migrations, seed.
- Key files: `prisma/schema.prisma` (Company, FinancialYear, User, RBAC, Item, Customer/Vendor, StockLedgerEntry, AccountingVoucher, DocumentSequence, DayClosing, AuditLog + bulk/import models).

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: root HTML shell.
- `src/app/(protected)/layout.tsx`: auth guard + AppShell.

**Configuration:**
- `next.config.ts`, `tsconfig.json` (`@/*` → `./src/*`), `tailwind.config.ts`, `postcss.config.mjs`.
- `.env*` (existence only — contain secrets, not read).

**Core Logic:**
- `src/server/services/accounting/vouchers.ts`: double-entry core.
- `src/server/services/inventory/stock-ledger.ts`: inventory movements.
- `src/server/api/request-context.ts`: tenant/user scope.
- `src/server/auth/session.ts`: session lifecycle.

**Testing:**
- `tests/*.test.mjs`, `tests/helpers/`, `scripts/prepare-test-db.mjs`.

## Naming Conventions

**Files:**
- Components: PascalCase `.tsx` (`SaleLpgForm.tsx`).
- Services/utils: kebab-case `.ts` (`sale-lpg.ts`, `document-numbers.ts`).
- Routes: Next.js fixed names `page.tsx`, `layout.tsx`, `route.ts`.
- Tests: `*.test.mjs`.

**Directories:**
- Route segments: kebab-case (`sale-lpg`, `purchase-filled-cylinder`).
- Route groups: parenthesized (`(auth)`, `(protected)`, `(setup)`).
- Dynamic segments: bracketed (`[id]`, `[documentNo]`, `[documentType]`).
- Service domains: kebab-case singular-ish (`master-data`, `opening-balances`).

## Where to Add New Code

**New transactional feature (e.g. a new operation):**
- Service: `src/server/services/<domain>/<feature>.ts` (do the DB transaction, voucher, stock, audit, permission here).
- API: `src/app/api/<domain>/<feature>/route.ts` (thin handler).
- Page: `src/app/(protected)/<group>/<feature>/page.tsx`.
- Form/UI: `src/components/<Feature>Form.tsx`.
- Nav entry: register in `src/lib/navigation/modules.ts`.

**New CRUD resource (config/master):**
- Mirror existing `configuration/<resource>` pairs: collection route + `[id]` route under `src/app/api/configuration/`, page under `(protected)/configuration/`, manager component in `src/components`.

**New report:**
- `src/app/api/reports/<name>/route.ts` (read-only) + `src/server/services/reports/*.ts` + `(protected)/reports/<name>/page.tsx`.

**Shared utility:**
- Client-safe → `src/lib/`. Server-only → `src/server/`.

**Schema change:**
- Edit `prisma/schema.prisma`, run `prisma migrate dev`; client regenerated via `postinstall`/`prisma:generate`.

## Special Directories

**`.next/`:** Build output. Generated: Yes. Committed: No.
**`node_modules/`:** Deps. Generated: Yes. Committed: No.
**`.local-postgres/`, `backups/`:** Local DB data / backups. Generated: Yes. Committed: No.
**`graphify-out/`, `graphify-output/`:** Knowledge-graph artifacts. Generated: Yes.
**`.planning/`:** GSD workflow + codebase map. Committed: Yes.
**`Wireframe/`, `docs/`:** Design/reference docs. Committed: Yes.

---

*Structure analysis: 2026-06-25*
