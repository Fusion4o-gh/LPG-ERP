# Session: Fix Non-Deterministic Accounting-Integrity Test Failure

**Date:** 2026-06-27
**Type:** Maintenance / Bug Fix
**Files modified:** `tests/accounting-integrity.test.mjs`

## Problem

Test 3 (`sale with COGS produces a balanced voucher that reduces stock asset balance`) failed intermittently in the full test suite (`npm test`) but always passed in isolation:

```
AssertionError: Stock should be 1000 after sale (initial 2000 - 1000 COGS)
  actual: 3200
  expected: 1000
```

The error value was non-deterministic — sometimes 3200, sometimes 7200, and sometimes it passed (1000).

## Root Cause

`node:test` runs test files **concurrently by default**. The test used aggregate GL queries (`AccountingVoucherLine.aggregate`) across the entire stock account for the company/financial year. When other test files ran concurrently and created stock vouchers, these aggregate queries picked up their data, corrupting the delta calculations.

Since each test file creates unique vouchers (via `doc("AI-*")` prefix), the fix was to scope assertions to specific vouchers by `sourceId` rather than summing across all vouchers.

## Fix

**File:** `tests/accounting-integrity.test.mjs:61-123`

**Before:** Three aggregate queries spanning all vouchers:
- `stockInitial` — aggregate stock balance before any operations
- `stockBefore` — aggregate after purchase, assert delta = 2000
- `stockAfter` — aggregate after sale, assert delta = 1000

**After:** Voucher-specific queries by `sourceId`:
- Query purchase voucher directly: assert stock debit = 2000
- Query sale voucher directly: assert stock credit = 1000, COGS debit = 1000

Removed aggregate queries entirely since they were vulnerable to concurrent test contamination.

## Verification

- Isolated run: 4/4 pass
- Full suite: accounting-integrity no longer in failing list (324 pass, 7 fail — all pre-existing)
