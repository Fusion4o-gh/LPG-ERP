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
    "src/components/ModuleTabBar.tsx",
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
    assert.match(await file(route), /OperationForm|BatchSaleForm|PurchaseFilledCylinderForm|SaleLpgForm|CylinderReturnForm|SecurityReceiptForm/);
  }
});

test("dashboard and navigation use LPG operational terminology", async () => {
  const nav = await file("src/lib/navigation/modules.ts");
  const tabBar = await file("src/components/ModuleTabBar.tsx");
  const dashboard = await file("src/app/(protected)/dashboard/page.tsx");

  for (const label of ["Purchase Filled Cylinder", "Sale LPG", "Complete Day Sale", "Cylinder Return", "Security Receipt"]) {
    assert.match(nav + tabBar + dashboard, new RegExp(label));
  }
});

test("Fusion4o branding assets and shell copy are present", async () => {
  const rootLayout = await file("src/app/layout.tsx");
  const loginPage = await file("src/app/(auth)/login/page.tsx");
  const sidebar = await file("src/components/Sidebar.tsx");
  const globals = await file("src/app/globals.css");

  await exists("public/fusion4o-logo.png");
  assert.match(rootLayout, /LPG Management System/);
  assert.match(rootLayout, /Operational LPG distribution, inventory, accounts, and reporting system/);
  assert.match(loginPage, /Operational control for LPG distribution businesses/);
  assert.match(loginPage, /Real-time stock tracking/);
  assert.match(loginPage + sidebar, /LPG Management System/);
  assert.match(globals, /--fusion-cyan/);
  assert.match(globals, /--fusion-blue/);
  assert.match(globals, /\.fusion-gradient/);
});

test("customer cylinder balance page keeps table formatters inside the client boundary", async () => {
  const page = await file("src/app/(protected)/customer-cylinder-balances/page.tsx");

  assert.match(page, /^"use client";/);
  assert.match(page, /render: \(row\)/);
});

test("role management normalizes listed RBAC role relations for the UI", async () => {
  const client = await file("src/app/(protected)/settings/roles/RoleManagementClient.tsx");

  assert.match(client, /function normalizeRole/);
  assert.match(client, /role\.userRoles/);
  assert.match(client, /role\.permissions/);
  assert.match(client, /setRoles\(roleData\.roles\.map\(normalizeRole\)\)/);
});

test("report pages with table formatters keep callbacks inside the client boundary", async () => {
  const reportPages = [
    "src/app/(protected)/reports/balance-sheet/page.tsx",
    "src/app/(protected)/reports/cash-book/page.tsx",
    "src/app/(protected)/reports/customer-ledger/page.tsx",
    "src/app/(protected)/reports/stock-summary/page.tsx",
    "src/app/(protected)/reports/trial-balance/page.tsx",
    "src/app/(protected)/reports/vendor-ledger/page.tsx",
  ];

  for (const route of reportPages) {
    const page = await file(route);
    assert.match(page, /^"use client";/, `${route} should be a client component`);
    assert.match(page, /render: \(row\)/, `${route} should define table formatters`);
  }

  const accessCylinders = await file("src/app/(protected)/reports/customer-cylinder-balances/AccessCylindersReportClient.tsx");
  assert.match(accessCylinders, /^"use client";/);
  assert.match(accessCylinders, /render: \(row\)/);
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
  assert.match(reportClient, /Preparing\.\.\./);
  assert.match(reportClient, /Filters:/);
  assert.match(reportClient, /data-report-print/);
  assert.match(reportClient, /data-print-only/);

  for (const route of reportPages) {
    await exists(route);
    const page = await file(route);
    if (route.endsWith("daily-activity/page.tsx")) {
      assert.match(page, /DailyActivityReportClient/);
    } else if (route.endsWith("profit-loss/page.tsx")) {
      assert.match(page, /ProfitLossReportClient/);
    } else if (route.endsWith("customer-cylinder-balances/page.tsx")) {
      assert.match(page, /AccessCylindersReportClient/);
    } else {
      assert.match(page, /ReportTableClient/);
    }
  }
});

test("print CSS hides navigation and actions while preserving report tables", async () => {
  const globals = await file("src/app/globals.css");
  const sidebar = await file("src/components/Sidebar.tsx");
  const tabBar = await file("src/components/ModuleTabBar.tsx");
  const appShell = await file("src/components/AppShell.tsx");
  const reportClient = await file("src/app/(protected)/reports/ReportTableClient.tsx");

  assert.match(globals, /@media print/);
  assert.match(globals, /\[data-print-hidden\]/);
  assert.match(globals, /\[data-report-print\] table/);
  assert.match(sidebar, /data-print-hidden/);
  assert.match(tabBar, /data-print-hidden/);
  assert.match(appShell, /ModuleTabBar/);
  assert.match(reportClient, /<form[\s\S]*data-print-hidden/);
});

test("print work does not modify report calculation services", async () => {
  const operationalReports = await file("src/server/services/reports/operational-reports.ts");
  const financialReports = await file("src/server/services/reports/financial-ledgers.ts");

  assert.doesNotMatch(operationalReports + financialReports, /window\.print|data-report-print|data-print-hidden|@media print/);
});
