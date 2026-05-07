# Graphify Usage Note

Graphify outputs for this repo are stored in `graphify-output/`:

- `graphify-output/GRAPH_REPORT.md` contains the human-readable graph report.
- `graphify-output/graph.json` contains the raw graph data.
- `graphify-output/graph.html` contains the interactive graph.

Use Graphify as a token-efficient targeting aid before implementation work. Start with `graphify-output/GRAPH_REPORT.md` to identify likely files, service names, domain concepts, and named functions, then inspect only those files plus directly related dependencies. Do not use Graphify as a replacement for reading the actual source before editing.

Generic Next.js route handler names such as `GET()`, `POST()`, and `PUT()` are noisy god nodes because many API route files export functions with the same names. Do not infer architecture from `GET()`, `POST()`, or `PUT()` edges alone. Prefer file paths, service names, domain names, and named functions over generic handler nodes.

Useful anchors for future LPG ERP work:

- `docs/architecture-decisions.md`
- `src/server/api/request-context.ts`
- `src/server/services/accounting/document-numbers.ts`
- `src/server/services/reversals/reversal-policy.ts`
- `src/server/services/inventory/day-closing.ts`
- `src/server/services/inventory/day-closing-operations.ts`
- `src/server/services/sales/sale-lpg.ts`
- `src/server/services/purchases/purchase-filled-cylinder.ts`
- `src/server/services/payments/payment-services.ts`

Recommended future prompt pattern:

> Use `docs/graphify-usage.md` and `graphify-output/GRAPH_REPORT.md` only to identify relevant files. Do not scan unrelated areas.
