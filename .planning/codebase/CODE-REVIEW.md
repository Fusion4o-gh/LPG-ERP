---
phase: codebase-company-scoping-fix
reviewed: 2026-06-25T12:17:54Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/server/services/accounting/accounts.ts
  - src/server/services/accounting/settlement-vouchers.ts
  - src/server/services/payments/payment-services.ts
  - src/server/services/purchases/purchase-empty-other.ts
  - src/server/services/purchases/purchase-filled-cylinder.ts
  - src/server/services/returns/cylinder-return.ts
  - src/server/services/returns/purchase-return.ts
  - src/server/services/sales/decanting-sale.ts
  - src/server/services/sales/empty-sale.ts
  - src/server/services/sales/sale-lpg.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Codebase: Company-Scoping Fix — Code Review Report

**Reviewed:** 2026-06-25T12:17:54Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The party/bank fix itself is correct and complete: every `customer`/`vendor`/`bank` lookup now uses `findFirstOrThrow({ where: { id, companyId } })` (or `findFirst({ id, companyId })` in `decanting-sale.ts`), and `getBankAccountId` correctly takes `companyId` from the trusted session context (`accounts.ts:42-48`). I traced all 10 files and found **no remaining party/bank lookup that trusts a request-supplied id without company scoping.**

However, the fix focused on the *party/bank* dimension and **left the `itemId` dimension fully unscoped across every transactional flow.** `itemId` is also a request-supplied identifier, and it is used to (a) write `StockLedgerEntry` rows, (b) upsert `CustomerCylinderBalance` / `VendorCylinderReturnBalance`, and (c) decrement those balances — none of which validate that the item belongs to `companyId`. `createStockLedgerEntry` (`inventory/stock-ledger.ts:22-68`) writes the trusted `companyId` next to an *unvalidated* `itemId`, and the balance tables key on `(customerId, itemId)` / `(vendorId, itemId)` with **no `companyId` column at all** (`prisma/schema.prisma:475-501`). This is the same class of cross-tenant bug the party fix addressed, still open on a different axis. `decanting-sale.ts` is the only file that validates its item (`if (!item) throw`), which is the pattern the others should follow.

## Critical Issues

### CR-01: `itemId` is never company-scoped in any sale/purchase/return flow — cross-tenant data corruption

**File:** `src/server/services/sales/sale-lpg.ts:255-259, 285-335`; `src/server/services/sales/empty-sale.ts:85-120`; `src/server/services/purchases/purchase-empty-other.ts:160-195, 276-321`; `src/server/services/purchases/purchase-filled-cylinder.ts:102-168`; `src/server/services/returns/cylinder-return.ts:100-138`; `src/server/services/returns/purchase-return.ts:147-174, 237-255`

**Issue:** Every flow fetches items with `tx.item.findMany({ where: { companyId, id: { in: [...lineItemIds] } } })`, but the result is used **only to build display labels** (`itemById`). There is no check that each `line.itemId` was actually returned. A caller in company A who supplies an `itemId` belonging to company B passes straight through to:
- `createStockLedgerEntry(...)`, which writes a `StockLedgerEntry` with the trusted `companyId` but the foreign `itemId` (`stock-ledger.ts:49-67` does no item↔company validation), and
- `customerCylinderBalance.upsert` / `vendorCylinderReturnBalance.upsert`, which key on `(customerId/vendorId, itemId)` with no company scoping (`schema.prisma:475-501`).

Because the stock `balanceAfter` is computed from prior entries filtered by `companyId + itemId` (`stock-ledger.ts:27-38`), a cross-tenant item produces a phantom ledger lineage under the wrong company. This is a multi-tenant isolation breach and silent accounting/inventory corruption — exactly the bug class the party fix was meant to close, left open on the item axis.

**Fix:** After `findMany`, assert completeness before any write. Apply in every listed flow:
```ts
const itemById = new Map(itemRows.map((item) => [item.id, item]));
for (const line of lines) {
  if (!itemById.has(line.itemId)) {
    throw new Error(`Item ${line.itemId} is invalid for this company.`);
  }
}
// for sale-lpg also validate line.emptyReturnItemId the same way
```
Mirror `decanting-sale.ts:58-62`, which already does this correctly for its single item.

### CR-02: `securityReceipt` writes cylinder balance with unvalidated `customerId` and `itemId`

**File:** `src/server/services/payments/payment-services.ts:197-251`

**Issue:** `securityReceipt` never looks up the customer or the item at all. It takes `input.customerId` and `input.itemId` directly from the request and writes them into `customerCylinderBalance.upsert` (lines 235-239) and into a balanced voucher / audit log. Unlike `cashReceipt`/`bankReceipt` in the same file (which now call `customerAccount(tx, companyId, customerId)`), this function performs **zero company scoping on the customer and zero existence/scoping check on the item.** A request can create or increment a `securityHeld` balance row for a `(customerId, itemId)` pair belonging to another tenant, and post a GL voucher referencing them.

**Fix:** Validate both before writing:
```ts
await tx.customer.findFirstOrThrow({ where: { id: input.customerId, companyId: input.companyId }, select: { id: true } });
await tx.item.findFirstOrThrow({ where: { id: input.itemId, companyId: input.companyId }, select: { id: true } });
```
Place these immediately after `assertWritableBusinessDate` (line 210).

### CR-03: Balance decrements/upserts operate on cross-tenant rows because balance tables lack `companyId`

**File:** `src/server/services/returns/cylinder-return.ts:80-92, 136`; `src/server/services/sales/sale-lpg.ts:130-143, 302-314, 333`; `src/server/services/purchases/purchase-filled-cylinder.ts:139-166`; `src/server/services/returns/purchase-return.ts:126-136, 173`

**Issue:** `decrementEmptyOwed`, `decrementCustomerEmptyOwed`, `reduceVendorEmptyDue`, and the `customerCylinderBalance`/`vendorCylinderReturnBalance` upserts all address rows by `{ customerId_itemId }` / `{ vendorId_itemId }` only. The schema has no `companyId` on these tables (`schema.prisma:475-501`), so the only protection against cross-tenant mutation is upstream validation of `customerId`/`vendorId`/`itemId`. The party ids are now validated (good), but the `itemId` is not (see CR-01), so an attacker-supplied foreign `itemId` combined with a valid same-company `customerId` will read/decrement/increment a balance row that need not belong to the company. `reduceVendorEmptyDue` additionally silently returns when no balance row exists (`purchase-return.ts:131`), masking the anomaly instead of failing.

**Fix:** Resolving CR-01/CR-02 (validate every `itemId` against `companyId`) closes the practical exploit. For defense-in-depth, add `companyId` to `CustomerCylinderBalance` and `VendorCylinderReturnBalance` and include it in the unique key + all `where` clauses, so the DB enforces isolation rather than relying solely on service-layer checks.

## Warnings

### WR-01: Stock movements are posted before item validation, so failures leave partial work mid-transaction

**File:** `src/server/services/sales/sale-lpg.ts:285-335`; `src/server/services/purchases/purchase-empty-other.ts:178-195`; `src/server/services/returns/cylinder-return.ts:118-138`

**Issue:** Even once CR-01 is fixed, placement matters. Today the stock-ledger loop and balance upserts run *before* any item completeness check could throw. Because everything is inside `prisma.$transaction`, a late throw rolls back — but validating items up front (before the loop) gives clearer errors and avoids computing balances for invalid items. Validate immediately after building `itemById`.

**Fix:** Move the item-completeness assertion (CR-01 snippet) to directly after the `findMany`, before the stock loop.

### WR-02: `cylinderReturn` decrements customer empty-owed before validating the customer exists

**File:** `src/server/services/returns/cylinder-return.ts:118-140`

**Issue:** `decrementEmptyOwed(tx, input.customerId, ...)` is called inside the stock loop (line 136), but `tx.customer.findFirstOrThrow({ id, companyId })` is not called until line 140 — *after* the loop. For an "Empty" return where `netReturnAmount` is 0, the customer is still mutated via the balance decrement before its company ownership is confirmed. With an invalid/foreign `customerId`, `decrementEmptyOwed` either throws "does not owe enough" (leaking existence) or, if a row exists, mutates a foreign balance. The customer lookup should gate the whole operation.

**Fix:** Move the `tx.customer.findFirstOrThrow(...)` from line 140 to immediately after `normalizeLines` (before the stock loop), so the customer is validated before any balance mutation.

### WR-03: `postVendorPayment` / `postCustomerReceipt` post GL vouchers against `partyAccountId` with no company check on the account

**File:** `src/server/services/accounting/settlement-vouchers.ts:31-163`

**Issue:** These helpers accept a raw `partyAccountId` and post debit/credit lines to it (e.g. lines 59-60, 119-120). All current callers derive `partyAccountId` from an already-company-scoped `vendor`/`customer` lookup, so today it is safe. But the function is a public export with no internal guarantee that `partyAccountId` belongs to `input.companyId`. `createBalancedVoucher` is the last line of defense; if it does not re-validate the account's company, a future caller could post cross-tenant. Document the invariant or validate the account's `companyId` inside `createBalancedVoucher`.

**Fix:** Confirm `createBalancedVoucher` validates each line's `accountId` against `companyId`; if not, add that check there, or have these helpers assert `chartAccount.findFirstOrThrow({ id: partyAccountId, companyId })`.

### WR-04: `getBankAccountId` returns `accountId` without confirming the bank's account is in the same company

**File:** `src/server/services/accounting/accounts.ts:42-48`

**Issue:** The bank is correctly scoped by `{ id: bankId, companyId }`, but it returns `bank.accountId` — a `ChartAccount` id. The `Bank.accountId` FK is not itself guaranteed to point at a chart account in the same company (the relation in `schema.prisma:470` has no company constraint). In normal data this holds, but a misconfigured/imported bank row could carry a foreign `accountId`, and this is the value posted into vouchers. Low likelihood, but it is the one remaining unverified hop in the bank path.

**Fix:** Either trust the data integrity invariant explicitly (comment) or validate: `const account = await tx.chartAccount.findFirst({ where: { id: bank.accountId, companyId }, select: { id: true } }); if (!account) throw ...`.

### WR-05: `decantingSale` ignores `sourceQuantity` vs `decantedQuantity` relationship and books stock by source count only

**File:** `src/server/services/sales/decanting-sale.ts:35-50, 64-77`

**Issue:** Not a tenancy issue, but a correctness gap surfaced while tracing the file. `sourceQuantity` (integer cylinders consumed) and `decantedQuantity` (kg/units sold) are validated independently, and the sale voucher is priced on `decantedQuantity * unitPrice` while stock is reduced by `sourceQuantity`. There is no check that decanting from `sourceQuantity` cylinders can actually yield `decantedQuantity`. A typo (e.g. 1 source cylinder, 9999 decanted kg) posts an over-valued sale with under-counted stock. Consider a sanity bound or per-item capacity factor.

**Fix:** Add a domain validation linking the two quantities (e.g. `decantedQuantity <= sourceQuantity * itemCapacityKg`), or document that the caller is responsible.

## Info

### IN-01: `purchaseEmptyCylinder` uses `StockSourceType.PURCHASE_FILLED` for empty-cylinder purchases

**File:** `src/server/services/purchases/purchase-empty-other.ts:186`; also `purchase-empty-other.ts:311`

**Issue:** Empty-cylinder and "other" purchases tag their stock ledger entries with `StockSourceType.PURCHASE_FILLED`. This mislabels the source type and will distort any reporting/reversal logic that filters by source type. Likely a copy-paste from `purchase-filled-cylinder.ts`.

**Fix:** Introduce/use a `PURCHASE_EMPTY` (or `PURCHASE_OTHER`) `StockSourceType`, or confirm the enum intentionally collapses these.

### IN-02: Discount-without-discount-account silently nets the discount into stock/sales instead of failing

**File:** `src/server/services/purchases/purchase-filled-cylinder.ts:170`; `src/server/services/sales/sale-lpg.ts:337`

**Issue:** When a discount is applied but the discount chart account is not configured, the code silently folds the discount into the stock credit / sales credit (`stockCredit = grossAmount.minus(discountAmount)`). The voucher balances, but the discount is invisible in the P&L. This is a deliberate fallback, but it hides a configuration gap. Consider logging or warning when this path is taken.

**Fix:** Emit a warning in the audit log when `discountAmount.gt(0) && !discountAccountId`, or require the discount account to be configured.

### IN-03: Repeated `decimal`/`label`/`normalizeCylinderState` helpers duplicated across 7 files

**File:** all sales/purchases/returns service files

**Issue:** Identical `decimal()`, `label()`, and near-identical `normalize*` helpers are copy-pasted into each service. This is maintenance risk: a fix to one (e.g. the `normalizeCylinderState` ambiguity around `EMPTY` vs `FILLED` defaulting) will not propagate. Extract to a shared `services/shared/money.ts` / `format.ts`.

**Fix:** Consolidate into shared utilities and import.

---

_Reviewed: 2026-06-25T12:17:54Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
