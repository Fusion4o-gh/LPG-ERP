# Reference Enums and Constants

The Prisma schema is authoritative. Before adding a value, inspect `prisma/schema.prisma` and the generated client.

Common voucher types currently used by the product include `CR` (cash receipt), `CP` (cash payment), `BR` (bank receipt), `BP` (bank payment), `JV` (journal), `SR` (sale), `PV` (purchase), and `OPV` (opening voucher). Do not assume a new type is safe: update accounting, reporting, permissions, and tests together.

Stock direction, cylinder state, audit actions, approval states, and source types are also Prisma-owned enums. Prefer imported enum values over string literals in server code. If a legacy label differs from an internal enum, translate it at the API/UI boundary and document the mapping.
