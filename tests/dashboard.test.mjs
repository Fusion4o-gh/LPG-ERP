import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const dashboard = await import("../src/server/services/dashboard/dashboard.ts");

async function fixture() {
  const suffix = doc("dash").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `Dash Test ${suffix}`, stockAvailableCheck: false } });
  const financialYear = await prisma.financialYear.create({
    data: { companyId: company.id, label: suffix, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isActive: true },
  });
  const admin = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: `Dash Admin ${suffix}`, loginId: `dash-admin-${suffix}`, passwordHash: "test" },
  });
  const adminRole = await prisma.role.create({ data: { companyId: company.id, name: `Admin ${suffix}` } });
  const reportsPermission = await prisma.permission.upsert({
    where: { module_action: { module: "reports", action: PermissionAction.VIEW } },
    update: {},
    create: { module: "reports", action: PermissionAction.VIEW },
  });
  await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: reportsPermission.id } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: admin.id };
  return { company, financialYear, admin, context };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("getDashboardData returns all expected KPI keys", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(typeof data.kpis.todayCash === "number");
  assert.ok(typeof data.kpis.cashPosition === "number");
  assert.ok(typeof data.kpis.receivables === "number");
  assert.ok(typeof data.kpis.payables === "number");
  assert.ok(typeof data.kpis.todaySale === "number");
  assert.ok(typeof data.kpis.expenses === "number");
  assert.ok(typeof data.kpis.mExpenses === "number");
  assert.ok(typeof data.backup.needsFirstBackup === "boolean");
  assert.ok(typeof data.backup.isStale === "boolean");
  assert.ok(Array.isArray(data.inTransit.booked));
  assert.ok(Array.isArray(data.inTransit.unbooked));
});

test("getDashboardData returns bank position array", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(Array.isArray(data.bankPosition));
  if (data.bankPosition.length > 0) {
    const bank = data.bankPosition[0];
    assert.ok("id" in bank);
    assert.ok("name" in bank);
    assert.ok("balance" in bank);
    assert.ok(typeof bank.balance === "number");
  }
});

test("getDashboardData returns current stock array", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(Array.isArray(data.currentStock));
  if (data.currentStock.length > 0) {
    const row = data.currentStock[0];
    assert.ok("itemCode" in row);
    assert.ok("filled" in row);
    assert.ok("empty" in row);
  }
});

test("getDashboardData returns sale stats with today and month", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(typeof data.saleStats.today.count === "number");
  assert.ok(typeof data.saleStats.today.amount === "number");
  assert.ok(typeof data.saleStats.month.count === "number");
  assert.ok(typeof data.saleStats.month.amount === "number");
  assert.equal(data.saleStats.month.year, new Date().getUTCFullYear());
  assert.equal(data.saleStats.month.month, new Date().getUTCMonth() + 1);
});

test("dashboard sale stats accept a selected month and year", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context, { month: 2, year: 2026 });
  assert.equal(data.saleStats.month.year, 2026);
  assert.equal(data.saleStats.month.month, 2);
});

test("getDashboardData returns bulk stock grouped by product and location", async () => {
  const { company, financialYear, context } = await fixture();
  const product = await prisma.bulkProduct.create({
    data: { companyId: company.id, code: doc("DASH-BULK-PRODUCT"), name: "Dashboard Bulk Product", unit: "MT" },
  });
  const location = await prisma.stockLocation.create({
    data: { companyId: company.id, code: doc("DASH-BULK-LOCATION"), name: "Dashboard Bulk Location" },
  });
  const opening = await prisma.bulkOpeningStock.create({
    data: { companyId: company.id, financialYearId: financialYear.id, productId: product.id, locationId: location.id, quantity: 12.5, unit: "MT", valuationRate: 500, createdById: context.userId },
  });
  await prisma.bulkStockLedgerEntry.createMany({
    data: [
      { companyId: company.id, financialYearId: financialYear.id, productId: product.id, locationId: location.id, direction: "IN", quantity: 12.5, unit: "MT", balanceAfter: 12.5, sourceType: "OPENING_STOCK", sourceId: opening.id, transactionDate: new Date("2026-02-01"), createdById: context.userId },
      { companyId: company.id, financialYearId: financialYear.id, productId: product.id, locationId: location.id, direction: "OUT", quantity: 2.5, unit: "MT", balanceAfter: 10, sourceType: "ADJUSTMENT", sourceId: doc("DASH-BULK-OUT"), transactionDate: new Date("2026-02-02"), createdById: context.userId },
    ],
  });

  const data = await dashboard.getDashboardData(context);
  assert.deepEqual(data.bulkStock, [{
    id: `${product.id}:${location.id}`,
    productCode: product.code,
    productName: product.name,
    locationCode: location.code,
    locationName: location.name,
    quantity: 10,
    amount: 5000,
    unit: "MT",
  }]);
});

test("dashboard in-transit summary is empty when no loading or partial receiving exists", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.deepEqual(data.inTransit, { booked: [], unbooked: [] });
});

test("dashboard in-transit summary exposes booked loadings and unbooked partial receiving", async () => {
  const { company, financialYear, context } = await fixture();
  const contract = await prisma.importContract.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      contractNo: doc("DASH-CONTRACT"),
      contractDate: new Date("2026-02-01"),
      importType: "TAFTAN",
      vendorId: doc("DASH-VENDOR"),
      productId: doc("DASH-PRODUCT"),
      quantity: 10,
      rateUsd: 900,
      exchangeRate: 280,
      amountUsd: 9000,
      amountPkr: 2520000,
      createdById: context.userId,
    },
  });
  await prisma.loading.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      contractId: contract.id,
      loadingType: "TAFTAN",
      loadingNo: doc("DASH-LOAD"),
      loadingDate: new Date("2026-02-02"),
      quantityLoaded: 5,
      rate: 900,
      freight: 0,
      finalRate: 900,
      createdById: context.userId,
    },
  });
  await prisma.partialReceiving.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      documentNo: doc("DASH-PARTIAL"),
      plantId: doc("DASH-PLANT"),
      locationId: doc("DASH-LOCATION"),
      productId: doc("DASH-BULK"),
      dispatchWeight: 4,
      totalQuantity: 4,
      remainingQuantity: 2.5,
      transactionDate: new Date("2026-02-03"),
      createdById: context.userId,
    },
  });

  const data = await dashboard.getDashboardData(context);
  assert.equal(data.inTransit.booked[0].label.endsWith(contract.contractNo), true);
  assert.equal(data.inTransit.booked[0].quantity, 5);
  assert.equal(data.inTransit.unbooked[0].quantity, 2.5);
});

test("unauthorized user denied for dashboard", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "No Perm Dash", loginId: doc("noperm-dash"), passwordHash: "test" },
  });
  const noPermContext = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };

  await assert.rejects(dashboard.getDashboardData(noPermContext), /permission/i);
});

test("dashboard client exposes all quick link labels", async () => {
  const root = new URL("../", import.meta.url);
  const client = await readFile(new URL("src/app/(protected)/dashboard/DashboardClient.tsx", root), "utf8");

  assert.match(client, /Single Sale/);
  assert.match(client, /Complete Day Sale/);
  assert.match(client, /Purchase/);
  assert.match(client, /Payment/);
  assert.match(client, /Receipt/);
  assert.match(client, /Cylinder Return/);
  assert.match(client, /Customer Ledger/);
  assert.match(client, /Stock Report/);
  assert.match(client, /Daily Activity/);
  assert.match(client, /Customer Stock Ledger/);
  assert.match(client, /Cash Book/);
  assert.match(client, /Profit\/Loss Report/);
  assert.match(client, /Sales month/);
  assert.match(client, /Sales year/);
});

test("dashboard collapsible sections persist operator preference", async () => {
  const root = new URL("../", import.meta.url);
  const client = await readFile(new URL("src/app/(protected)/dashboard/DashboardClient.tsx", root), "utf8");

  assert.match(client, /lpg-dashboard-section:/);
  assert.match(client, /aria-expanded=\{open\}/);
  assert.match(client, /storageKey="bank-position"/);
  assert.match(client, /storageKey="current-stock"/);
});
