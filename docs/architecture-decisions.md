# LPG ERP Architecture Decisions

This record locks current architecture decisions for future LPG ERP work. Reconsider these only when explicitly assigned.

## Product Identity

- Generic product name: LPG ERP.
- Do not use any specific company name in UI, docs, code comments, or future prompts unless explicitly requested.

## Stack

- Next.js App Router.
- TypeScript.
- PostgreSQL.
- Prisma.
- Tailwind CSS.
- Node built-in test runner.
- Do not add Vitest, Jest, Vite, tsx, or esbuild tooling unless explicitly approved.

## Architecture

- UI calls API routes.
- API routes call the service layer.
- Service layer owns business logic.
- Frontend must not duplicate accounting, stock, RBAC, or document-number logic.
- All writes go through services.

## Domain Rules

- Customer money balance and customer cylinder accountability are separate.
- Stock movements are immutable ledger entries.
- Financial actions create balanced vouchers.
- Document numbers are centralized and scoped by company plus financial year.
- Reversal documents use the centralized `RV` prefix and remain scoped by company plus financial year.
- Supported payment reversal kinds are `cash-receipt`, `cash-payment`, `bank-receipt`, and `bank-payment`; generic `payment` reversal is not a valid contract.
- Transactions include companyId, financialYearId, and userId where applicable.
- Closed-day writes are blocked unless override permission exists.
- Audit log is required for create, update, reversal, and security-sensitive actions.
- TODO: introduce a dedicated Reversal table before production if audit/voucher/stock source references are not sufficient as the reversal source of truth.

## Auth And RBAC

- Authentication is session-backed.
- Request context derives userId, companyId, and financialYearId.
- UI may hide features by role, but service and API enforcement is authoritative.

## Database

- PostgreSQL only.
- Do not switch to SQLite.
- Do not create mutable stock totals as the source of truth.
- Prisma schema changes require explicit approval unless fixing validation.

## UI

- Use generic LPG ERP naming.
- Build mobile-friendly operational UI.
- Prefer business-first design over decorative UI.
- Do not build reports, print, or export unless explicitly assigned.

## Development Constraints

- Do not modify unrelated files.
- Prefer small bounded changes.
- Run only validations relevant to the change.
- Run full validation only at checkpoints.

## Current Local Caveats

- The exFAT/SWC workaround exists for local Windows filesystem behavior and must not influence domain architecture.
- The Prisma package.json seed warning is non-blocking until Prisma 7 migration is explicitly assigned.
