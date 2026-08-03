# Repository Index

## Application

- `src/app/(protected)/` — authenticated pages grouped by configuration, operations, payments, reports, imports, plant, dollar workflows, and database administration.
- `src/app/api/` — HTTP API routes. Routes should authenticate through `getRequestContext` and delegate business behavior.
- `src/components/` — client forms, report tables, shell components, printable documents, and shared controls.
- `src/server/services/` — domain logic, accounting, inventory, reporting, permissions, audit, backup, and migration helpers.
- `src/lib/` — API client, navigation, permissions, date/configuration helpers, themes, and shared validation.

## Data and tooling

- `prisma/schema.prisma` — authoritative data model and enums.
- `prisma/migrations/` — applied schema history; never edit an applied migration to change meaning.
- `scripts/smoke-local-routes.mjs` — authenticated route smoke harness.
- `scripts/import-legacy-backup.mjs` — safe read-only legacy artifact validation/import gate.
- `scripts/verify-legacy-migration.mjs` — migration reconciliation verifier.
- `tests/*.test.mjs` — service, API, UI contract, migration, and route smoke tests.

## Product documentation

- `docs/current-erp-inventory.md` — current module and route inventory.
- `docs/parity-roadmap.md` — parity status, evidence, and remaining work.
- `docs/uat-legacy-parity-checklist.md` — manual reference-vs-local UAT checklist.
- `docs/original-live-audit.json` — captured reference navigation audit.
- `docs/legacy-migration.md` — legacy backup safety and migration gate.
- `docs/architecture-decisions.md` — durable architectural decisions.
- `HANDOFF.md` — current agent checkpoint.
- `CHANGELOG.md` — user-visible change history.
