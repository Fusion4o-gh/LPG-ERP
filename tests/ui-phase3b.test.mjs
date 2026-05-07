import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function file(path) {
  return readFile(new URL(path, root), "utf8");
}

async function exists(path) {
  const result = await stat(new URL(path, root)).then(() => true, () => false);
  assert.equal(result, true, `${path} should exist`);
}

test("Phase 3B reusable UI components exist", async () => {
  const components = [
    "src/components/AppShell.tsx",
    "src/components/Sidebar.tsx",
    "src/components/PageHeader.tsx",
    "src/components/DataTable.tsx",
    "src/components/FormSection.tsx",
    "src/components/SubmitButton.tsx",
    "src/components/ApiError.tsx",
    "src/components/SuccessMessage.tsx",
  ];

  for (const component of components) {
    await exists(component);
  }
});

test("Phase 3B operational pages are wired to existing APIs", async () => {
  const routes = [
    "src/app/(protected)/operations/purchase-filled-cylinder/page.tsx",
    "src/app/(protected)/operations/sale-lpg/page.tsx",
    "src/app/(protected)/operations/complete-day-sale/page.tsx",
    "src/app/(protected)/operations/cylinder-return/page.tsx",
    "src/app/(protected)/payments/cash-receipt/page.tsx",
    "src/app/(protected)/payments/cash-payment/page.tsx",
    "src/app/(protected)/payments/bank-receipt/page.tsx",
    "src/app/(protected)/payments/bank-payment/page.tsx",
    "src/app/(protected)/payments/security-receipt/page.tsx",
  ];

  for (const route of routes) {
    await exists(route);
    assert.match(await file(route), /OperationForm|BatchSaleForm/);
  }
});

test("dashboard and sidebar use LPG ERP operational terminology", async () => {
  const sidebar = await file("src/components/Sidebar.tsx");
  const dashboard = await file("src/app/(protected)/dashboard/page.tsx");

  for (const label of ["Purchase Filled Cylinder", "Sale LPG", "Complete Day Sale", "Cylinder Return", "Security Receipt"]) {
    assert.match(sidebar + dashboard, new RegExp(label));
  }
});

test("report pages include shared print action and print metadata", async () => {
  const reportClient = await file("src/app/(protected)/reports/ReportTableClient.tsx");
  const reportPages = [
    "src/app/(protected)/reports/stock-summary/page.tsx",
    "src/app/(protected)/reports/customer-cylinder-balances/page.tsx",
    "src/app/(protected)/reports/daily-activity/page.tsx",
    "src/app/(protected)/reports/customer-ledger/page.tsx",
    "src/app/(protected)/reports/vendor-ledger/page.tsx",
    "src/app/(protected)/reports/cash-book/page.tsx",
    "src/app/(protected)/reports/trial-balance/page.tsx",
    "src/app/(protected)/reports/profit-loss/page.tsx",
    "src/app/(protected)/reports/balance-sheet/page.tsx",
  ];

  assert.match(reportClient, /window\.print\(\)/);
  assert.match(reportClient, /Print/);
  assert.match(reportClient, /Generated:/);
  assert.match(reportClient, /Filters:/);
  assert.match(reportClient, /data-report-print/);
  assert.match(reportClient, /data-print-only/);

  for (const route of reportPages) {
    await exists(route);
    assert.match(await file(route), /ReportTableClient/);
  }
});

test("print CSS hides navigation and actions while preserving report tables", async () => {
  const globals = await file("src/app/globals.css");
  const sidebar = await file("src/components/Sidebar.tsx");
  const reportClient = await file("src/app/(protected)/reports/ReportTableClient.tsx");

  assert.match(globals, /@media print/);
  assert.match(globals, /\[data-print-hidden\]/);
  assert.match(globals, /\[data-report-print\] table/);
  assert.match(sidebar, /data-print-hidden/);
  assert.match(reportClient, /<form[\s\S]*data-print-hidden/);
});

test("print work does not modify report calculation services", async () => {
  const operationalReports = await file("src/server/services/reports/operational-reports.ts");
  const financialReports = await file("src/server/services/reports/financial-ledgers.ts");

  assert.doesNotMatch(operationalReports + financialReports, /window\.print|data-report-print|data-print-hidden|@media print/);
});
