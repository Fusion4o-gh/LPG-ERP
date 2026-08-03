import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("accounting report pages expose reference filter controls", async () => {
  const root = new URL("../src/app/(protected)/reports/", import.meta.url);
  const [transactions, multiple, combine, shared] = await Promise.all([
    readFile(new URL("transactions-listing/page.tsx", root), "utf8"),
    readFile(new URL("multiple-ledger/page.tsx", root), "utf8"),
    readFile(new URL("combine-ledger/page.tsx", root), "utf8"),
    readFile(new URL("ReportTableClient.tsx", root), "utf8"),
  ]);

  assert.match(transactions, /showVoucherTypeFilter\s+showReportUserFilter\s+showVoucherRangeFilter/);
  assert.match(multiple, /showAccountSlotsFilter/);
  assert.match(combine, /showAccountSlotsFilter/);
  assert.match(shared, /A\/C Title \(\{index \+ 1\}\)/);
  assert.match(shared, /Date to Date/);
  assert.match(shared, /Voucher to Voucher/);
  assert.match(shared, /value="JVD"/);
  assert.match(shared, /value="HDP"/);
});

test("report table loads URL filters in the first request", async () => {
  const source = await readFile(new URL("../src/app/(protected)/reports/ReportTableClient.tsx", import.meta.url), "utf8");
  assert.match(source, /const initialFilters = \{/);
  assert.match(source, /load\(initialFilters\)/);
  assert.match(source, /reportUrl\(undefined, filterValues\)/);
});

test("company transaction defaults use the browser's local calendar date", async () => {
  const source = await readFile(new URL("../src/lib/use-company-form-settings.ts", import.meta.url), "utf8");
  assert.match(source, /getFullYear\(\)/);
  assert.match(source, /getMonth\(\) \+ 1/);
  assert.match(source, /getDate\(\)/);
  assert.doesNotMatch(source, /toISOString\(\)\.slice\(0, 10\)/);
});

test("transaction entry forms use the shared local-date helper", async () => {
  const files = [
    "OpeningBalanceManagers.tsx",
    "LossGainClient.tsx",
    "LoadingManager.tsx",
    "DeliveryChallanManager.tsx",
    "ItemPriceManager.tsx",
    "PhysicalCountForm.tsx",
    "WarehouseTransferForm.tsx",
  ];
  const sources = await Promise.all(files.map((name) => readFile(new URL(`../src/components/${name}`, import.meta.url), "utf8")));
  for (const source of sources) {
    assert.match(source, /todayDateInputValue/);
    assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.(slice|split)\(/);
  }
});
