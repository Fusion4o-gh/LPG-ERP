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
    "src/app/(protected)/purchases/filled-cylinder/page.tsx",
    "src/app/(protected)/purchases/filled-cylinder/add/page.tsx",
    "src/app/(protected)/purchases/empty-cylinder/page.tsx",
    "src/app/(protected)/purchases/empty-cylinder/add/page.tsx",
    "src/app/(protected)/purchases/other/page.tsx",
    "src/app/(protected)/purchases/other/add/page.tsx",
    "src/app/(protected)/operations/sale-lpg/page.tsx",
    "src/app/(protected)/operations/sale-lpg/add/page.tsx",
    "src/app/(protected)/operations/complete-day-sale/page.tsx",
    "src/app/(protected)/operations/cylinder-return/page.tsx",
    "src/app/(protected)/operations/cylinder-return/add/page.tsx",
    "src/app/(protected)/payments/cash-receipt/page.tsx",
    "src/app/(protected)/payments/cash-receipt/add/page.tsx",
    "src/app/(protected)/payments/cash-payment/page.tsx",
    "src/app/(protected)/payments/cash-payment/add/page.tsx",
    "src/app/(protected)/payments/bank-receipt/page.tsx",
    "src/app/(protected)/payments/bank-payment/page.tsx",
    "src/app/(protected)/payments/security-receipt/page.tsx",
    "src/app/(protected)/payments/security-receipt/add/page.tsx",
    "src/app/(protected)/sale-purchase/empty-sale/page.tsx",
    "src/app/(protected)/sale-purchase/empty-sale/add/page.tsx",
    "src/app/(protected)/sale-purchase/decanting-sale/page.tsx",
    "src/app/(protected)/sale-purchase/decanting-sale/add/page.tsx",
  ];

  const listMatchers = [
    ["sale-lpg/page.tsx", /SaleLpgList/],
    ["purchases/filled-cylinder/page.tsx", /PurchaseFilledCylinderList/],
    ["cylinder-return/page.tsx", /CylinderReturnList/],
    ["security-receipt/page.tsx", /SecurityReceiptList/],
    ["cash-receipt/page.tsx", /PaymentVoucherList/],
    ["cash-payment/page.tsx", /PaymentVoucherList/],
    ["purchases/empty-cylinder/page.tsx", /PurchaseEmptyCylinderList/],
    ["purchases/other/page.tsx", /PurchaseOtherList/],
    ["empty-sale/page.tsx", /EmptySaleList/],
    ["decanting-sale/page.tsx", /DecantingSaleList/],
  ];

  for (const route of routes) {
    await exists(route);
    const page = await file(route);
    const listMatch = listMatchers.find(([suffix]) => route.endsWith(suffix));
    if (listMatch) {
      assert.match(page, listMatch[1]);
    } else if (route.endsWith("/add/page.tsx")) {
      assert.match(page, /Form|MultiLinePaymentForm/);
    } else {
      assert.match(page, /OperationForm|BatchSaleForm|MultiLinePaymentForm/);
    }
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

test("security receipt exposes the reference stock-issued preview", async () => {
  const form = await file("src/components/SecurityReceiptForm.tsx");

  assert.match(form, /\/api\/stock-availability\?itemId=/);
  assert.match(form, /Stock Issued/);
  assert.match(form, /Remarks/);
  assert.match(form, /chequeDate/);
  assert.match(form, /readOnly/);
});

test("filled purchase exposes the reference empty-stock preview", async () => {
  const form = await file("src/components/PurchaseFilledCylinderForm.tsx");
  assert.match(form, /cylinderState=EMPTY/);
  assert.match(form, /Empty Stock/);
  assert.match(form, /readOnly disabled/);
});

test("empty sale exposes the reference empty-stock preview", async () => {
  const form = await file("src/components/EmptySaleForm.tsx");
  assert.match(form, /cylinderState=EMPTY/);
  assert.match(form, /Empty Stock/);
  assert.match(form, /emptyStockByItem/);
  assert.match(form, /readOnly disabled/);
});

test("Access Cylinders exposes both reference balance views", async () => {
  const client = await file("src/app/(protected)/reports/customer-cylinder-balances/AccessCylindersReportClient.tsx");

  assert.match(client, /LPG Access Cylinders \(Customers\)/);
  assert.match(client, /LPG Access Cylinders \(Own Business\)/);
  assert.match(client, /\/api\/reports\/customer-cylinder-balances/);
  assert.match(client, /\/api\/reports\/stock-summary/);
});

test("cylinder conversion exposes state-specific stock previews", async () => {
  const form = await file("src/components/CylinderConversionForm.tsx");
  assert.match(form, /fromFilledStock/);
  assert.match(form, /toEmptyStock/);
  assert.match(form, /Filled Stock/);
  assert.match(form, /Empty Stock/);
  assert.match(form, /cylinderState=EMPTY/);
  assert.match(form, /readOnly disabled/);
});

test("driver and license screens expose license metadata", async () => {
  const page = await file("src/app/(protected)/configuration/drivers/page.tsx");
  const report = await file("src/app/(protected)/reports/license-detail/page.tsx");
  assert.match(page, /License Class/);
  assert.match(page, /License Issued/);
  assert.match(page, /License Expiry/);
  assert.match(report, /licenseClass/);
  assert.match(report, /licenseExpiry/);
});

test("self-service profile editing is exposed from the authenticated shell", async () => {
  const page = await file("src/app/(protected)/configuration/profile/page.tsx");
  const route = await file("src/app/api/auth/profile/route.ts");
  const topbar = await file("src/components/Topbar.tsx");
  assert.match(page, /Save Profile/);
  assert.match(route, /UserProfile/);
  assert.match(topbar, /\/configuration\/profile/);
});

test("bulk product navigation has a working master-data page", async () => {
  const page = await file("src/app/(protected)/configuration/bulk-products/page.tsx");
  const route = await file("src/app/api/configuration/bulk-products/route.ts");
  const updateRoute = await file("src/app/api/configuration/bulk-products/[id]/route.ts");
  assert.match(page, /Bulk Products/);
  assert.match(page, /\/api\/configuration\/bulk-products/);
  assert.match(route, /listBulkProducts/);
  assert.match(updateRoute, /updateBulkProduct/);
});

test("global search exposes keyboard focus and accessible result behavior", async () => {
  const search = await file("src/components/GlobalSearch.tsx");
  assert.match(search, /metaKey \|\| event\.ctrlKey/);
  assert.match(search, /event\.key === "Escape"/);
  assert.match(search, /role="combobox"/);
  assert.match(search, /No matching records/);
  assert.match(search, /setOpen\(true\)/);
});

test("shared master-data forms initialize required option fields", async () => {
  const manager = await file("src/components/MasterDataManager.tsx");
  assert.match(manager, /field\.required && field\.options\?\.\[0\]/);
  assert.match(manager, /field\.name === "status" \? "ACTIVE"/);
});

test("chart of accounts exposes captured reference metadata fields", async () => {
  const page = await file("src/app/(protected)/accounting/chart-of-accounts/page.tsx");
  const route = await file("src/app/api/chart-of-accounts/route.ts");
  assert.match(page, /Debit Limit/);
  assert.match(page, /Balance Sheet Account/);
  assert.match(page, /Opening Type/);
  assert.match(route, /isBalanceSheet/);
  assert.match(route, /openingBalanceType/);
});

test("item coding exposes the reference Define Prices workflow", async () => {
  const page = await file("src/app/(protected)/masters/items/page.tsx");
  const manager = await file("src/components/ItemPriceManager.tsx");
  const route = await file("src/app/api/items/[id]/price/route.ts");

  assert.match(page, /Define Prices/);
  assert.match(page, /\/masters\/items\/\[id\]\/prices/);
  assert.match(manager, /Price History/);
  assert.match(manager, /Price Per KG/);
  assert.match(route, /export async function GET/);
  assert.match(route, /validTo cannot be before validFrom/);
});

test("master-data tables expose reference search and pagination controls", async () => {
  const table = await file("src/components/DataTable.tsx");
  const manager = await file("src/components/MasterDataManager.tsx");

  assert.match(table, /enableControls/);
  assert.match(table, /Search:/);
  assert.match(table, /Display/);
  assert.match(table, /Previous/);
  assert.match(table, /Next/);
  assert.match(table, /\[10, 25, 50, 100\]/);
  assert.match(manager, /enableControls/);
});

test("operator list screens opt into the shared reference list controls", async () => {
  const listScreens = [
    "src/components/VendorMasterManager.tsx",
    "src/components/VoucherListPageClient.tsx",
    "src/components/AuditLogViewer.tsx",
    "src/app/(protected)/configuration/user-management/UserManagementClient.tsx",
  ];
  for (const screen of listScreens) assert.match(await file(screen), /enableControls/);
});

test("Sale B/W Date starts on the current working date like the reference", async () => {
  const page = await file("src/app/(protected)/reports/sale-between-dates/page.tsx");

  assert.match(page, /function today\(\)/);
  assert.match(page, /from: date, to: date/);
  assert.match(page, /Sale Detail Report/);
  assert.match(page, /Sale Report/);
});

test("Stock Report exposes the reference category filter", async () => {
  const page = await file("src/app/(protected)/reports/stock-summary/page.tsx");
  const shared = await file("src/app/(protected)/reports/ReportTableClient.tsx");
  assert.match(page, /showCategoryFilter/);
  assert.match(shared, /showCategoryFilter/);
  assert.match(shared, /All Categories/);
});

test("Chart Of Account Report exposes the reference level filter", async () => {
  const page = await file("src/app/(protected)/reports/chart-of-account/page.tsx");
  const shared = await file("src/app/(protected)/reports/ReportTableClient.tsx");
  assert.match(page, /showAccountLevelFilter/);
  assert.match(page, /showDateFilter=\{false\}/);
  assert.match(shared, /All Levels/);
  assert.match(shared, /Level A/);
  assert.match(shared, /Level D/);
  assert.match(shared, /showDateFilter \|\|/);
});

test("Fusion4o branding assets and shell copy are present", async () => {
  const rootLayout = await file("src/app/layout.tsx");
  const loginPage = await file("src/app/(auth)/login/page.tsx");
  const loginForm = await file("src/components/LoginForm.tsx");
  const sidebar = await file("src/components/Sidebar.tsx");
  const globals = await file("src/app/globals.css");

  await exists("public/fusion4o-logo.png");
  assert.match(rootLayout, /LPG Management System/);
  assert.match(rootLayout, /Operational LPG distribution, inventory, accounts, and reporting system/);
  assert.match(loginForm, /Sign in to your account/);
  assert.match(loginPage, /Powered by fusion4o/);
  assert.match(loginPage + sidebar, /LPG Management System|LPG Management/);
  assert.match(globals, /--gas-blue/);
  assert.match(globals, /--flame-orange/);
  assert.match(globals, /\.accent-tile/);
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
    "src/app/(protected)/reports/group-summary/page.tsx",
    "src/app/(protected)/reports/stock-by-location/page.tsx",
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
    } else if (route.endsWith("group-summary/page.tsx")) {
      assert.match(page, /window\.print\(\)/);
      assert.match(page, /format\?\: "csv"/);
    } else if (route.endsWith("stock-by-location/page.tsx")) {
      const stockByLocation = await file("src/components/StockByLocationTable.tsx");
      assert.match(stockByLocation, /window\.print\(\)/);
      assert.match(stockByLocation, /reportUrl\("csv"\)/);
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

test("accounting reports expose reconciliation summaries", async () => {
  const reportClient = await file("src/app/(protected)/reports/ReportTableClient.tsx");
  const trialBalance = await file("src/app/(protected)/reports/trial-balance/page.tsx");
  const balanceSheet = await file("src/app/(protected)/reports/balance-sheet/page.tsx");

  assert.match(reportClient, /summaryFields/);
  assert.match(reportClient, /summaryFields\.map/);
  assert.match(reportClient, /print:break-inside-avoid/);
  assert.match(trialBalance, /Total Debit/);
  assert.match(trialBalance, /isBalanced/);
  assert.match(balanceSheet, /Total Assets/);
  assert.match(balanceSheet, /balanceDifference/);
});

test("reversal deep links prefill the selected kind and document", async () => {
  const panel = await file("src/components/ReversalPanel.tsx");
  assert.match(panel, /searchParams\.get\("documentNo"\)/);
  assert.match(panel, /searchParams\.get\("kind"\)/);
  assert.match(panel, /todayDateInputValue\(\)/);
  assert.doesNotMatch(panel, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
});
