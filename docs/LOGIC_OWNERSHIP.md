# Logic Ownership

| Concern | Owner | Rule |
|---|---|---|
| Authentication/session/company/FY scope | `src/server/auth`, `src/server/api/request-context.ts` | Routes obtain context centrally; services never trust a client-supplied company. |
| Permission enforcement | `src/server/permissions`, service boundaries | Enforce writes and sensitive reads server-side; UI filtering is not authorization. |
| Accounting | `src/server/services/accounting` and transaction services | All posted vouchers must balance; reversals are compensating records. |
| Stock and cylinder accountability | `src/server/services/inventory`, purchase/sale/return services | Use immutable ledger movements and shared stock guards. |
| Document numbers | `src/server/services/accounting/document-numbers.ts` | Generate scoped numbers through the shared allocator. |
| Audit history | `src/server/services/audit` | Write audit records in the same transaction as the business change when possible. |
| Business dates/day close | `src/server/services/inventory/day-closing.ts` | Shared write guard owns working-day, hours, and closed-day policy. |
| Reports/CSV | `src/server/services/reports` | JSON and CSV must use the same query/calculation path. |
| UI state and presentation | `src/components`, page clients | Forms collect/format input; they must not duplicate accounting or stock rules. |
| Legacy migration | `scripts/import-legacy-backup.mjs`, `scripts/verify-legacy-migration.mjs` | Read-only until an authorized decrypted SQL dump and reviewed mapping exist. |

When two modules appear to own the same rule, do not duplicate it. Find the shared boundary or document a deliberate exception.
