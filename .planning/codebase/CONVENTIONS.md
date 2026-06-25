# Coding Conventions

**Analysis Date:** 2026-06-25

## Naming Patterns

**Files:**
- Server services, libs, API routes: kebab-case `.ts` (e.g. `src/server/services/sales/sale-lpg.ts`, `src/lib/api-client.ts`, `src/app/api/accounting/vouchers/route.ts`)
- React components: PascalCase `.tsx` (e.g. `src/components/SaleLpgForm.tsx`, `src/components/SubmitButton.tsx`)
- Client sub-components co-located with pages use `...Client.tsx` suffix (e.g. `src/app/(protected)/dashboard/DashboardClient.tsx`, `UserManagementClient.tsx`)
- Next.js App Router reserved names: `page.tsx`, `layout.tsx`, `route.ts` (framework-mandated)
- Tests: kebab-case `.test.mjs` in `tests/` (e.g. `tests/decanting-sale.test.mjs`)

**Functions:**
- camelCase verbs (e.g. `readJson`, `getRequestContext`, `createBalancedVoucher`, `enforcePermission`, `apiPost`)
- React components exported as named PascalCase functions: `export function SubmitButton(...)`
- Route handlers are uppercase HTTP verbs: `export async function GET/POST/PUT/DELETE(request: Request)`

**Variables:**
- camelCase for locals and params (`companyId`, `financialYearId`, `voucher`)
- SCREAMING_SNAKE_CASE for module-level constants and lookup maps (e.g. `ACCOUNT_CODES`, `DOCUMENT_PREFIXES`, `SEED_COMPANY_NAME`, `DEFAULT_TEST_DB`)

**Types:**
- PascalCase for `type` aliases (e.g. `SaleInput`, `SaleLpgLineInput`, `BatchInput`, `ApiResult<T>`, `Body`)
- Prefer inline `type` aliases over `interface` throughout the server layer
- Prisma enums imported by name (`CylinderState`, `PartyType`, `VoucherType`, `PermissionAction`)

## Code Style

**Formatting:**
- No Prettier/ESLint/Biome config present in repo — formatting is by convention, not enforced
- 2-space indentation, double quotes for strings, semicolons present, trailing commas in multiline literals
- Long object literals frequently kept on a single line (e.g. Prisma `select` blocks in `src/app/api/accounting/vouchers/route.ts`)

**Linting:**
- None configured. TypeScript `strict: true` in `tsconfig.json` is the primary correctness gate.
- `noEmit: true`, `isolatedModules: true`, `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`

## Import Organization

**Order (observed):**
1. Node built-ins (`node:fs`, `node:path`, `node:assert/strict`) — in tests/scripts
2. Third-party / Prisma (`@prisma/client`, `next`, `react`)
3. Internal modules

**Path style:**
- `tsconfig.json` defines alias `@/*` → `./src/*`
- Server/API code uses explicit **relative paths with `.ts` extensions** (e.g. `import { prisma } from "../../../../lib/prisma.ts";`) rather than the `@/` alias. Match the surrounding file's style.
- Tests import implementation via dynamic `await import("../src/...ts")` so the `.mjs` runner can load TS through the Node loader.

## Error Handling

**Server services:** throw plain `Error` with user-facing messages (e.g. `throw new Error(\`${name} is required.\`)` in `src/server/api/validation.ts`).

**API routes:** wrap the whole handler in `try/catch` and funnel errors through `serviceError(error)`:
```ts
export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    // ...
    return ok({ ... });
  } catch (error) {
    return serviceError(error);
  }
}
```

**Response envelope** (`src/server/api/responses.ts`):
- Success: `ok(data)` → `{ success: true, ...data }`
- Failure: `fail(message, status, code)` → `{ success: false, error: { code, message } }`
- `serviceError` maps messages matching `/permission/i` to HTTP 403 `FORBIDDEN`, otherwise 400 `BAD_REQUEST`

**Client:** `src/lib/api-client.ts` throws `Error(data.error.message)` when `!response.ok || !data.success`, so components catch and surface `error.message`.

## Validation

- Centralized hand-rolled validators in `src/server/api/validation.ts` — no schema library (no Zod/Yup).
- Pattern: each helper reads a named field from the parsed `Body` and throws a descriptive `Error` on failure: `stringField`, `optionalStringField`, `positiveIntegerField`, `positiveNumberField`, `dateField`, `booleanField`, `arrayField`.
- `readJson(request)` guards that the body is a non-array JSON object before field extraction.
- When adding a new input, add/reuse a validator here rather than inlining checks.

## Logging

- No logging framework. Errors propagate as thrown `Error`s and are converted to HTTP responses. Avoid stray `console.log` in committed code.

## Comments

- Sparse. Code is expected to be self-documenting via descriptive names and small functions. No JSDoc/TSDoc convention in use.

## Function Design

- Small, single-purpose functions; validators and response helpers are one-liners.
- Service functions take a single typed input object (e.g. `SaleInput`) carrying `companyId`, `financialYearId`, `userId` plus domain fields — pass context explicitly, do not rely on globals.
- Monetary values flow as `string | number` into services and as Prisma `Decimal` out (use `.equals()` for comparison, see vouchers route).

## Module Design

**Exports:**
- Named exports only (no default exports), including React components.
- Route files export HTTP-verb functions; service files export domain functions and constant maps.

**Barrel files:**
- Not used. Import directly from the specific module file.

## Component Conventions

- `"use client"` directive at top of interactive components and `src/lib/api-client.ts`; server components omit it. ~38 of the component files are client components.
- Hooks (`useState`/`useEffect`) used in ~32 components; data fetching via the `apiGet/apiPost/...` helpers from `src/lib/api-client.ts`.
- Styling via Tailwind utility classes plus shared classes like `btn-primary`; inline `style` only for dynamic one-offs (see `src/components/SubmitButton.tsx`).
- Forms pair with a `SubmitButton` showing a spinner and "Saving…" while `loading`.

---

*Convention analysis: 2026-06-25*
