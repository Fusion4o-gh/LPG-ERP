import assert from "node:assert/strict";
import test from "node:test";
import { CylinderState, PermissionAction, PrismaClient, StockDirection, StockSourceType, VoucherType } from "@prisma/client";

const prisma = new PrismaClient();
const reports = await import("../src/server/services/reports/operational-reports.ts");
const sessions = await import("../src/server/auth/session.ts");
const stockSummaryRoute = await import("../src/app/api/reports/stock-summary/route.ts");
const customerCylinderBalancesRoute = await import("../src/app/api/reports/customer-cylinder-balances/route.ts");
const dailyActivityRoute = await import("../src/app/api/reports/daily-activity/route.ts");

const cleanup = {
  stockSourceIds: new Set(),
  voucherNos: new Set(),
  customerIds: new Set(),
  itemIds: new Set(),
  userIds: new Set(),
};

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function source(prefix) {
  const value = doc(prefix);
  cleanup.stockSourceIds.add(value);
  return value;
}

function voucherNo(prefix) {
  const value = doc(prefix);
  cleanup.voucherNos.add(value);
  return value;
}

async function fixture() {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({ where: { companyId: company.id, isActive: true } });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  const item = await prisma.item.findFirstOrThrow({ where: { companyId: company.id, code: "CYL-11.8-PSO" } });
  const customerSeed = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id, code: "C-0001" } });
  return { company, financialYear, user, item, customerSeed };
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

async function createReportItem(companyId, seedItem, prefix = "RPT-ITEM") {
  const item = await prisma.item.create({
    data: {
      companyId,
      code: doc(prefix),
      name: `${prefix} Cylinder`,
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  cleanup.itemIds.add(item.id);
  return item;
}

function csvRows(csv) {
  return csv.trim().split(/\r?\n/).map((row) => row.split(","));
}

function uniqueReportDate() {
  const offsetDays = Math.floor(Math.random() * 3650) + 365;
  return new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

test.after(async () => {
  if (cleanup.stockSourceIds.size) await prisma.stockLedgerEntry.deleteMany({ where: { sourceId: { in: [...cleanup.stockSourceIds] } } });
  if (cleanup.voucherNos.size) await prisma.accountingVoucher.deleteMany({ where: { voucherNo: { in: [...cleanup.voucherNos] } } });
  if (cleanup.customerIds.size) await prisma.customerCylinderBalance.deleteMany({ where: { customerId: { in: [...cleanup.customerIds] } } });
  if (cleanup.customerIds.size) await prisma.customer.deleteMany({ where: { id: { in: [...cleanup.customerIds] } } });
  if (cleanup.itemIds.size) await prisma.item.deleteMany({ where: { id: { in: [...cleanup.itemIds] } } });
  if (cleanup.userIds.size) await prisma.session.deleteMany({ where: { userId: { in: [...cleanup.userIds] } } });
  if (cleanup.userIds.size) await prisma.user.deleteMany({ where: { id: { in: [...cleanup.userIds] } } });
  await prisma.$disconnect();
});

test("stock summary report calculates filled, empty, and net movement from ledger", async () => {
  const { company, financialYear, user, item: seedItem } = await fixture();
  const item = await createReportItem(company.id, seedItem);
  const date = "2026-12-01";
  await prisma.stockLedgerEntry.createMany({
    data: [
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: item.id,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.IN,
        sourceType: StockSourceType.PURCHASE_FILLED,
        sourceId: source("RPT-PUR"),
        transactionDate: new Date(date),
        quantity: 10,
        balanceAfter: 10,
        createdById: user.id,
      },
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: item.id,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.OUT,
        sourceType: StockSourceType.SALE_LPG,
        sourceId: source("RPT-SALE"),
        transactionDate: new Date(date),
        quantity: 3,
        balanceAfter: 7,
        createdById: user.id,
      },
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: item.id,
        cylinderState: CylinderState.EMPTY,
        direction: StockDirection.IN,
        sourceType: StockSourceType.CYLINDER_RETURN,
        sourceId: source("RPT-RET"),
        transactionDate: new Date(date),
        quantity: 2,
        balanceAfter: 2,
        createdById: user.id,
      },
    ],
  });

  const rows = await reports.getStockSummaryReport(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { from: date, to: date, itemId: item.id },
  );
  const row = rows.find((entry) => entry.id === item.id);
  assert.ok(row);
  assert.equal(row.filledQuantity, 7);
  assert.equal(row.emptyQuantity, 2);
  assert.equal(row.netMovement, 9);
});

test("customer cylinder balance report returns outstanding empty cylinders and last movement date", async () => {
  const { company, financialYear, user, item: seedItem, customerSeed } = await fixture();
  const item = await createReportItem(company.id, seedItem, "RPT-CB-ITEM");
  const customer = await prisma.customer.create({
    data: { companyId: company.id, code: doc("RPT-C"), name: "Report Customer", accountId: customerSeed.accountId },
  });
  cleanup.customerIds.add(customer.id);
  await prisma.customerCylinderBalance.create({
    data: { customerId: customer.id, itemId: item.id, emptyOwed: 4 },
  });
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      customerId: customer.id,
      cylinderState: CylinderState.EMPTY,
      direction: StockDirection.IN,
      sourceType: StockSourceType.CYLINDER_RETURN,
      sourceId: source("RPT-CB"),
      transactionDate: new Date("2026-12-02"),
      quantity: 1,
      balanceAfter: 1,
      createdById: user.id,
    },
  });

  const rows = await reports.getCustomerCylinderBalanceReport(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { customerId: customer.id, itemId: item.id },
  );
  assert.equal(rows[0].outstandingEmptyCylinders, 4);
  assert.equal(rows[0].lastMovementDate.toISOString().slice(0, 10), "2026-12-02");
});

test("daily activity report aggregates source counts, voucher counts, and stock movements", async () => {
  const { company, financialYear, user, item: seedItem } = await fixture();
  const item = await createReportItem(company.id, seedItem);
  const date = uniqueReportDate();
  await prisma.stockLedgerEntry.createMany({
    data: [
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: item.id,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.OUT,
        sourceType: StockSourceType.SALE_LPG,
        sourceId: source("RPT-SALE"),
        transactionDate: new Date(date),
        quantity: 1,
        balanceAfter: 1,
        createdById: user.id,
      },
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: item.id,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.IN,
        sourceType: StockSourceType.PURCHASE_FILLED,
        sourceId: source("RPT-PUR"),
        transactionDate: new Date(date),
        quantity: 1,
        balanceAfter: 2,
        createdById: user.id,
      },
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: item.id,
        cylinderState: CylinderState.EMPTY,
        direction: StockDirection.IN,
        sourceType: StockSourceType.CYLINDER_RETURN,
        sourceId: source("RPT-RET"),
        transactionDate: new Date(date),
        quantity: 1,
        balanceAfter: 3,
        createdById: user.id,
      },
    ],
  });
  await prisma.accountingVoucher.createMany({
    data: [
      { companyId: company.id, financialYearId: financialYear.id, voucherNo: voucherNo("RPT-CR"), voucherType: VoucherType.CR, voucherDate: new Date(date), createdById: user.id },
      { companyId: company.id, financialYearId: financialYear.id, voucherNo: voucherNo("RPT-BR"), voucherType: VoucherType.BR, voucherDate: new Date(date), createdById: user.id },
    ],
  });

  const summary = await reports.getDailyActivityReport(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { from: date, to: date },
  );
  assert.equal(summary.salesCount, 1);
  assert.equal(summary.purchaseCount, 1);
  assert.equal(summary.cylinderReturnsCount, 1);
  assert.equal(summary.cashVoucherCount, 1);
  assert.equal(summary.bankVoucherCount, 1);
  assert.equal(summary.stockMovements, 3);
});

test("report API rejects invalid date filters", async () => {
  const { user } = await fixture();
  const response = await stockSummaryRoute.GET(await authedGet(user, "http://localhost/api/reports/stock-summary?from=not-a-date"));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.error.message, /from must be a valid date/i);
});

test("unauthorized user is denied report access", async () => {
  const { company, financialYear } = await fixture();
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No Reports"), loginId: doc("no-reports"), passwordHash: "test" },
  });
  cleanup.userIds.add(user.id);

  await assert.rejects(
    reports.getStockSummaryReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, {}),
    /permission/i,
  );
});

test("stock summary CSV uses report filters and business-friendly headers", async () => {
  const { company, financialYear, user, item: seedItem } = await fixture();
  const item = await createReportItem(company.id, seedItem, "CSV-ITEM");
  const date = "2027-01-04";
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.IN,
      sourceType: StockSourceType.PURCHASE_FILLED,
      sourceId: source("CSV-STOCK"),
      transactionDate: new Date(date),
      quantity: 5,
      balanceAfter: 5,
      createdById: user.id,
    },
  });

  const request = await authedGet(user, `http://localhost/api/reports/stock-summary?format=csv&from=${date}&to=${date}&itemId=${item.id}`);
  const response = await stockSummaryRoute.GET(request);
  const parsed = csvRows(await response.text());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.deepEqual(parsed[0], ["Item Code", "Item Name", "Filled Quantity", "Empty Quantity", "Net Movement"]);
  assert.deepEqual(parsed[1], [item.code, item.name, "5", "0", "5"]);
});

test("customer cylinder balance CSV outputs filtered balances", async () => {
  const { company, financialYear, user, item: seedItem, customerSeed } = await fixture();
  const item = await createReportItem(company.id, seedItem, "CSV-CB-ITEM");
  const customer = await prisma.customer.create({
    data: { companyId: company.id, code: doc("CSV-C"), name: "CSV Balance Customer", accountId: customerSeed.accountId },
  });
  cleanup.customerIds.add(customer.id);
  await prisma.customerCylinderBalance.create({ data: { customerId: customer.id, itemId: item.id, emptyOwed: 7 } });
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      customerId: customer.id,
      cylinderState: CylinderState.EMPTY,
      direction: StockDirection.IN,
      sourceType: StockSourceType.CYLINDER_RETURN,
      sourceId: source("CSV-CB"),
      transactionDate: new Date("2027-01-05"),
      quantity: 7,
      balanceAfter: 7,
      createdById: user.id,
    },
  });

  const request = await authedGet(user, `http://localhost/api/reports/customer-cylinder-balances?format=csv&customerId=${customer.id}&itemId=${item.id}`);
  const response = await customerCylinderBalancesRoute.GET(request);
  const parsed = csvRows(await response.text());

  assert.equal(response.status, 200);
  assert.deepEqual(parsed[0], ["Customer Code", "Customer Name", "Item Code", "Item Name", "Outstanding Empty Cylinders", "Last Movement Date"]);
  assert.deepEqual(parsed[1], [customer.code, customer.name, item.code, item.name, "7", "2027-01-05"]);
});

test("daily activity CSV matches JSON report calculation for the same filters", async () => {
  const { company, financialYear, user, item: seedItem } = await fixture();
  const item = await createReportItem(company.id, seedItem, "CSV-DAILY-ITEM");
  const date = uniqueReportDate();
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.SALE_LPG,
      sourceId: source("CSV-DAILY"),
      transactionDate: new Date(date),
      quantity: 1,
      balanceAfter: 1,
      createdById: user.id,
    },
  });

  const summary = await reports.getDailyActivityReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { from: date, to: date });
  const request = await authedGet(user, `http://localhost/api/reports/daily-activity?format=csv&from=${date}&to=${date}`);
  const response = await dailyActivityRoute.GET(request);
  const parsed = csvRows(await response.text());

  assert.equal(response.status, 200);
  assert.deepEqual(parsed[0], ["Sales Count", "Purchase Count", "Cylinder Returns Count", "Cash Voucher Count", "Bank Voucher Count", "Stock Movements"]);
  assert.deepEqual(parsed[1], [
    String(summary.salesCount),
    String(summary.purchaseCount),
    String(summary.cylinderReturnsCount),
    String(summary.cashVoucherCount),
    String(summary.bankVoucherCount),
    String(summary.stockMovements),
  ]);
});

test("unauthorized CSV report request is denied", async () => {
  const { company, financialYear } = await fixture();
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No CSV Reports"), loginId: doc("no-csv-reports"), passwordHash: "test" },
  });
  cleanup.userIds.add(user.id);

  const response = await stockSummaryRoute.GET(await authedGet(user, "http://localhost/api/reports/stock-summary?format=csv"));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "FORBIDDEN");
});
