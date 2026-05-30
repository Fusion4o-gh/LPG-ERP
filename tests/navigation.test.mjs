import assert from "node:assert/strict";
import test from "node:test";

const navigation = await import("../src/lib/navigation/modules.ts");

test("resolveModule maps report routes to reports module", () => {
  const resolved = navigation.resolveModule("/reports/customer-ledger");
  assert.equal(resolved?.module.id, "reports");
  assert.equal(resolved?.activeTab?.label, "Customer Ledger");
  assert.equal(resolved?.activeGroup?.id, "ledgers");
});

test("resolveModule maps masters routes to configuration module", () => {
  const resolved = navigation.resolveModule("/masters/items");
  assert.equal(resolved?.module.id, "configuration");
  assert.equal(resolved?.activeTab?.href, "/masters/items");
  assert.equal(resolved?.activeGroup?.id, "masters");
});

test("resolveModule maps day closing to configuration setup group", () => {
  const resolved = navigation.resolveModule("/operations/day-closing");
  assert.equal(resolved?.module.id, "configuration");
  assert.equal(resolved?.activeTab?.href, "/operations/day-closing");
});

test("resolveModule maps sale purchase operations routes", () => {
  const resolved = navigation.resolveModule("/operations/sale-lpg");
  assert.equal(resolved?.module.id, "sale-purchase");
  assert.equal(resolved?.activeTab?.label, "Sale LPG");
});

test("resolveModule hides tab bar context on dashboard and print routes", () => {
  assert.equal(navigation.resolveModule("/dashboard"), null);
  assert.equal(navigation.resolveModule("/operations/sale-lpg/print/SI-1"), null);
});

test("database module hides tab bar flag", () => {
  const resolved = navigation.resolveModule("/database-backup");
  assert.equal(resolved?.module.id, "database");
  assert.equal(resolved?.module.hideTabBar, true);
});

test("navigation registry includes journal vouchers and bank payments tabs", () => {
  const payment = navigation.NAV_MODULES.find((module) => module.id === "payment-receipt");
  const tabs = navigation.allTabs(payment);
  assert.ok(tabs.some((tab) => tab.href === "/payments/journal-vouchers"));
  assert.ok(tabs.some((tab) => tab.href === "/payments/bank-payments-receipts"));
});

test("filterModules removes tabs user cannot access", () => {
  const permissions = ["reports:VIEW"];
  const modules = navigation.filterModules(permissions);
  assert.equal(modules.length, 1);
  assert.equal(modules[0].id, "reports");
});

test("firstPermittedReportHref returns first visible report tab", () => {
  const href = navigation.firstPermittedReportHref(["reports:VIEW"]);
  assert.equal(href, "/reports/sale-between-dates");
});
