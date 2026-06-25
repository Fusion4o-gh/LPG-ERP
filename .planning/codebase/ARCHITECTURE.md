<!-- refreshed: 2026-06-25 -->
# Architecture

**Analysis Date:** 2026-06-25

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Client (Browser, React 19)                │
├──────────────────┬──────────────────┬───────────────────────┤
│  Server Pages    │  Client Forms    │   API Client          │
│ `(protected)/`   │ `src/components` │  `src/lib/api-client` │
│  *page.tsx*      │  *Form.tsx*      │  (fetch wrapper)      │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │ RSC render        │ fetch JSON         │
         ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              API Route Handlers (thin controllers)           │
│   `src/app/api/**/route.ts`                                  │
│   auth → validate input → call service → ok()/serviceError() │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Domain Service Layer (business logic)        │
│   `src/server/services/<domain>/*.ts`                        │
│   transactions, double-entry vouchers, stock ledger, RBAC   │
└─────────────────────────────┬───────────────────────────────┘
                              │ prisma client
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         PostgreSQL via Prisma ORM  `src/lib/prisma.ts`       │
│         schema: `prisma/schema.prisma`                       │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Server pages | Route entry, RSC composition of client components | `src/app/(protected)/**/page.tsx` |
| Client components | Forms, lists, tables, all interactivity | `src/components/*.tsx` |
| API client | Browser-side fetch wrapper, error normalization | `src/lib/api-client.ts` |
| API route handlers | Auth, input validation, service dispatch | `src/app/api/**/route.ts` |
| Domain services | Business rules, transactions, accounting | `src/server/services/<domain>/*.ts` |
| API helpers | Request context, validation, responses | `src/server/api/*.ts` |
| Auth | Session cookies, password, app-shell context | `src/server/auth/*.ts` |
| Prisma client | Singleton DB access | `src/lib/prisma.ts` |
| Navigation registry | Module/route metadata, sidebar/tab config | `src/lib/navigation/modules.ts` |

## Pattern Overview

**Overall:** Layered monolith on Next.js 15 App Router — server-rendered pages + REST-style internal API + a dedicated server service layer over Prisma/PostgreSQL.

**Key Characteristics:**
- Thin API route handlers; all business logic lives in `src/server/services`.
- Double-entry accounting core: every financial operation produces a balanced `AccountingVoucher`.
- Multi-tenant by `companyId` + `financialYearId`, threaded through every service call via `RequestContext`.
- Domain-driven service folders (sales, purchases, accounting, inventory, payments, returns, reversals, reports, rbac, etc.).

## Layers

**Presentation (App Router):**
- Purpose: Render pages, host client forms.
- Location: `src/app/(auth)`, `src/app/(protected)`, `src/app/(setup)`
- Contains: `layout.tsx`, `page.tsx` (server components composing `src/components` clients).
- Depends on: components, auth (for layout guard).
- Used by: browser.

**API (Route Handlers):**
- Purpose: Internal REST endpoints.
- Location: `src/app/api/**/route.ts`
- Contains: `GET/POST/PUT/DELETE` handlers.
- Depends on: `src/server/api` helpers, `src/server/services`.
- Used by: client components via `src/lib/api-client.ts`.

**Service (Domain Logic):**
- Purpose: Business rules, DB transactions, accounting/stock integrity.
- Location: `src/server/services/<domain>`
- Depends on: `src/lib/prisma.ts`, sibling services (accounts, vouchers, stock-ledger, audit, rbac).
- Used by: API route handlers, server pages (e.g. app-shell context).

**Data:**
- Purpose: Persistence.
- Location: `prisma/schema.prisma`, accessed through `src/lib/prisma.ts`.

## Data Flow

### Primary Request Path (LPG sale)

1. User submits `SaleLpgForm` → calls `apiPost("/api/sales/lpg", …)` (`src/components/SaleLpgForm.tsx`, `src/lib/api-client.ts`)
2. `POST` handler authenticates and validates input (`src/app/api/sales/lpg/route.ts`)
3. `nextDocumentNumber` issues a document number (`src/server/services/accounting/document-numbers.ts`)
4. `saleLpgSingle` runs the transaction: permission check, stock availability, stock ledger entry, balanced voucher, audit log (`src/server/services/sales/sale-lpg.ts`)
5. Handler returns `ok({ issueNo, voucherNo, ids… })`; client parses via `parseResponse` (`src/server/api/responses.ts`)

### Page Render (protected route)

1. `ProtectedLayout` reads session from cookies; redirects to `/login` if absent (`src/app/(protected)/layout.tsx`)
2. Loads permissions + app-shell context in parallel (`src/server/services/rbac/permissions.ts`, `src/server/auth/app-shell-context.ts`)
3. Wraps children in `AppShell` (`src/components/AppShell.tsx`)
4. Page server component renders client forms/lists.

**State Management:**
- No global client store. Server is source of truth; client components fetch with `cache: "no-store"` and hold local React state. Theme/financial-year selection persisted via API + cookies/preferences.

## Key Abstractions

**RequestContext:**
- Purpose: Tenant + user scope (`companyId`, `financialYearId`, `userId`) for every service call.
- Examples: `src/server/api/request-context.ts`, `src/server/auth/session.ts`
- Pattern: Derived from session cookie (or `x-*` headers in test mode).

**Balanced Voucher:**
- Purpose: Enforces double-entry accounting (debits == credits, non-zero).
- Examples: `src/server/services/accounting/vouchers.ts`
- Pattern: `assertBalancedVoucher` + `createBalancedVoucher(tx, …)` called inside service transactions.

**Stock Ledger Entry:**
- Purpose: Append-only inventory movement (cylinder state, direction, source).
- Examples: `src/server/services/inventory/stock-ledger.ts`, `stock-availability.ts`

**Document Numbers:**
- Purpose: Per-company/year sequenced document numbers with prefixes.
- Examples: `src/server/services/accounting/document-numbers.ts` (`DocumentSequence` model)

## Entry Points

**Root layout:**
- Location: `src/app/layout.tsx`
- Triggers: every page.
- Responsibilities: html shell, theme hydration.

**Protected layout:**
- Location: `src/app/(protected)/layout.tsx`
- Triggers: all authenticated routes.
- Responsibilities: session guard, permission loading, `AppShell`.

**API health:**
- Location: `src/app/api/health/route.ts`
- Triggers: monitoring.

**Build/migrate:**
- `package.json` build runs `prisma migrate deploy` then `next build`.

## Architectural Constraints

- **Threading:** Single-threaded Node/Next request model. Services rely on Prisma `$transaction` (`Prisma.TransactionClient`) for atomicity.
- **Global state:** Prisma client is a global singleton cached on `globalThis` in non-production (`src/lib/prisma.ts`) to avoid connection exhaustion during HMR.
- **Tenancy:** Every service query must filter by `companyId` and `financialYearId`; omitting them leaks cross-tenant data.
- **No middleware file:** No `src/middleware.ts` — auth is enforced per-layout (`ProtectedLayout`) and per-route (`getRequestContext`), not globally.
- **Imports:** API routes use long relative `../../../` paths; pages/components use the `@/*` alias (`tsconfig.json`). Both styles coexist.

## Anti-Patterns

### Business logic in route handlers
**What happens:** Some routes assemble large input objects inline before dispatching to services.
**Why it's wrong:** Validation/shaping drifts from the service contract and is hard to reuse.
**Do this instead:** Keep handlers thin — validate with `src/server/api/validation.ts`, then pass to a single service function as in `src/app/api/sales/lpg/route.ts`.

### Mixed import conventions
**What happens:** API routes use deep relative imports while UI uses `@/`.
**Why it's wrong:** Refactors break long relative chains; inconsistent navigation.
**Do this instead:** Prefer the `@/*` alias everywhere new code is added.

### Permission check inside vs. outside transaction
**What happens:** `enforcePermission` takes a `Tx`; calling it outside a transaction or skipping it bypasses RBAC.
**Why it's wrong:** Unauthorized writes.
**Do this instead:** Call `enforcePermission(tx, userId, module, action)` as the first step inside each mutating service transaction (see `sale-lpg.ts`).

## Error Handling

**Strategy:** Services throw `Error` (or typed errors like `PermissionDeniedError`); handlers catch and convert to JSON.

**Patterns:**
- `serviceError(error)` maps `/permission/i` messages → 403, else 400 (`src/server/api/responses.ts`).
- Handlers return `fail(message, status, code)` for explicit validation failures.
- Client `parseResponse` throws on `!success`, surfaced via `ApiError`/`SuccessMessage` components.

## Cross-Cutting Concerns

**Logging:** Prisma logs errors/warns (`src/lib/prisma.ts`); domain mutations write to `AuditLog` via `src/server/services/audit/audit-log.ts`.
**Validation:** Centralized field helpers in `src/server/api/validation.ts`.
**Authentication:** Cookie session (`src/server/auth/session.ts`, `session-cookies.ts`); RBAC permissions in `src/server/services/rbac`.

---

*Architecture analysis: 2026-06-25*
