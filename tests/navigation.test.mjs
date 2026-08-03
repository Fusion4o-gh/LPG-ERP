import assert from "node:assert/strict";
import { access } from "node:fs/promises";
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

test("resolveModule maps sale operations routes to sales module", () => {
  const resolved = navigation.resolveModule("/operations/sale-lpg");
  assert.equal(resolved?.module.id, "sales");
  assert.equal(resolved?.activeTab?.label, "Sale LPG");
});

test("resolveModule maps purchase routes to purchases module", () => {
  const resolved = navigation.resolveModule("/purchases/filled-cylinder");
  assert.equal(resolved?.module.id, "purchases");
  assert.equal(resolved?.activeTab?.label, "Purchase Filled Cylinder");
});

test("resolveModule maps stock routes without purchase screens", () => {
  const resolved = navigation.resolveModule("/sale-purchase/cylinder-conversion");
  assert.equal(resolved?.module.id, "stock");
  assert.equal(resolved?.activeTab?.label, "Cylinder Conversion");
  assert.equal(navigation.resolveModule("/operations/purchase-filled-cylinder"), null);
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
  assert.ok(tabs.some((tab) => tab.href === "/dollar/settlements"));
});

test("navigation registry exposes plant delivered sale", () => {
  const plant = navigation.NAV_MODULES.find((module) => module.id === "plant");
  assert.ok(navigation.allTabs(plant).some((tab) => tab.href === "/plant/delivered-sale"));
});

test("navigation registry exposes dollar purchase and sale workflows", () => {
  const dollar = navigation.NAV_MODULES.find((module) => module.id === "dollar");
  const tabs = navigation.allTabs(dollar);
  assert.ok(tabs.some((tab) => tab.href === "/dollar/dollar-purchase"));
  assert.ok(tabs.some((tab) => tab.href === "/dollar/dollar-sale"));
});

test("navigation registry exposes the implemented import contract module", () => {
  const imported = navigation.resolveModule("/import/import-contracts");
  assert.equal(imported?.module.id, "import");
  assert.equal(imported?.activeTab?.label, "All Contracts");
});

test("navigation registry exposes Opening Voucher under configuration opening", () => {
  const resolved = navigation.resolveModule("/configuration/opening-voucher");
  assert.equal(resolved?.module.id, "configuration");
  assert.equal(resolved?.activeTab?.label, "Opening Voucher");
  assert.equal(resolved?.activeGroup?.id, "opening");
});

test("navigation registry exposes implemented dollar report variant", () => {
  const reports = navigation.NAV_MODULES.find((module) => module.id === "reports");
  const tabs = navigation.allTabs(reports);
  assert.ok(tabs.some((tab) => tab.href === "/reports/sale-contract-dollar-summary"));
});

test("every visible navigation tab has a backing page route", async () => {
  const tabs = navigation.NAV_MODULES.flatMap((module) => navigation.allTabs(module));
  const missing = [];

  for (const tab of tabs) {
    const pathname = tab.href.split(/[?#]/, 1)[0];
    const candidates = [
      `src/app/(protected)${pathname}/page.tsx`,
      `src/app/(setup)${pathname}/page.tsx`,
      `src/app${pathname}/page.tsx`,
    ];
    let found = false;
    for (const candidate of candidates) {
      try {
        await access(candidate);
        found = true;
        break;
      } catch {
        // Keep checking the other route groups.
      }
    }
    if (!found) missing.push(`${tab.label} (${tab.href})`);
  }

  assert.deepEqual(missing, [], `navigation tabs without page routes: ${missing.join(", ")}`);
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
