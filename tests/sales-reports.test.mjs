import assert from "node:assert/strict";
import test from "node:test";
import { CylinderState, PermissionAction, PrismaClient, StockDirection, StockSourceType, VoucherType } from "@prisma/client";

const prisma = new PrismaClient();
const salesReports = await import("../src/server/services/reports/sales-reports.ts");
const sessions = await import("../src/server/auth/session.ts");
const saleBetweenDatesRoute = await import("../src/app/api/reports/sale-between-dates/route.ts");
const oneCustomerSaleHistoryRoute = await import("../src/app/api/reports/one-customer-sale-history/route.ts");
const saleReturnRoute = await import("../src/app/api/reports/sale-return/route.ts");

const cleanup = {
  stockSourceIds: new Set(),
  voucherNos: new Set(),
  auditEntityIds: new Set(),
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

function vno(prefix) {
  const value = doc(prefix);
  cleanup.voucherNos.add(value);
  return value;
}

function csvRows(csv) {
  return csv.trim().split(/\r?\n/).map((row) => row.split(","));
}

async function fixture() {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({ where: { companyId: company.id, isActive: true } });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  const seedItem = await prisma.item.findFirstOrThrow({ where: { companyId: company.id, code: "CYL-11.8-PSO" } });
  const seedCustomer = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id, code: "C-0001" } });
  return { company, financialYear, user, seedItem, seedCustomer };
}

async function createTestItem(companyId, seedItem, prefix = "SR-ITEM") {
  const item = await prisma.item.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Cylinder`, categoryId: seedItem.categoryId, brandId: seedItem.brandId },
  });
  cleanup.itemIds.add(item.id);
  return item;
}

async function createTestCustomer(companyId, seedCustomer, prefix = "SR-C") {
  const customer = await prisma.customer.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Customer`, accountId: seedCustomer.accountId },
  });
  cleanup.customerIds.add(customer.id);
  return customer;
}

async function createSaleEntry(companyId, financialYearId, userId, issueNo, customerId, itemId, quantity, date) {
  await prisma.stockLedgerEntry.create({
    data: {
      companyId,
      financialYearId,
      itemId,
      customerId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.SALE_LPG,
      sourceId: issueNo,
      transactionDate: new Date(date),
      quantity,
      balanceAfter: 0,
      createdById: userId,
    },
  });
  await prisma.accountingVoucher.create({
    data: {
      companyId,
      financialYearId,
      voucherNo: issueNo,
      voucherType: VoucherType.SR,
      voucherDate: new Date(date),
      sourceType: "SaleLpg",
      sourceId: issueNo,
      totalDebit: quantity * 1500,
      totalCredit: quantity * 1500,
      createdById: userId,
    },
  });
  cleanup.voucherNos.add(issueNo);
}

async function createReturnEntry(companyId, financialYearId, userId, returnNo, customerId, itemId, quantity, cylinderState, date) {
  await prisma.stockLedgerEntry.create({
    data: {
      companyId,
      financialYearId,
      itemId,
      customerId,
      cylinderState,
      direction: StockDirection.IN,
      sourceType: StockSourceType.CYLINDER_RETURN,
      sourceId: returnNo,
      transactionDate: new Date(date),
      quantity,
      balanceAfter: 0,
      createdById: userId,
    },
  });
  cleanup.stockSourceIds.add(returnNo);
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
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

test("sale between dates report returns sales in date range", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const customer = await createTestCustomer(company.id, seedCustomer);
  const issueNo = source("SR-SALE");
  const date = "2027-03-10";

  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 5, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await salesReports.getSaleBetweenDatesReport(context, { from: date, to: date });

  const row = rows.find((r) => r.issueNo === issueNo);
  assert.ok(row, "should find sale row");
  assert.equal(row.transactionDate, date);
  assert.equal(row.customerCode, customer.code);
  assert.equal(row.customerName, customer.name);
  assert.equal(row.totalQty, 5);
  assert.ok(Number(row.saleAmount) > 0);
});

test("sale between dates item mode returns line-level rows", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const customer = await createTestCustomer(company.id, seedCustomer);
  const issueNo = source("SR-ITEM");
  const date = "2027-03-11";

  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 2, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await salesReports.getSaleBetweenDatesReport(context, { from: date, to: date, mode: "item" });

  const row = rows.find((r) => r.issueNo === issueNo);
  assert.ok(row, "should find item row");
  assert.equal(row.itemCode, item.code);
  assert.equal(row.totalQty, 2);
});

test("sale between dates type mode groups by sale type", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const customer = await createTestCustomer(company.id, seedCustomer);
  const issueNo = source("SR-TYPE");
  const date = "2027-03-12";

  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 1, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await salesReports.getSaleBetweenDatesReport(context, { from: date, to: date, mode: "type" });

  assert.ok(rows.some((r) => r.saleType && Number(r.invoiceCount) >= 1));
});

test("sale between dates excludes sales outside date range", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const customer = await createTestCustomer(company.id, seedCustomer);
  const issueNo = source("SR-EXCL");

  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 3, "2027-03-05");

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await salesReports.getSaleBetweenDatesReport(context, { from: "2027-03-10", to: "2027-03-15" });

  const found = rows.some((r) => r.issueNo === issueNo);
  assert.equal(found, false, "sale outside range should not appear");
});

test("one customer sale history filters by customer", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const customerA = await createTestCustomer(company.id, seedCustomer, "SR-CA");
  const customerB = await createTestCustomer(company.id, seedCustomer, "SR-CB");
  const issueA = source("SR-HIST-A");
  const issueB = source("SR-HIST-B");
  const date = "2027-03-12";

  await createSaleEntry(company.id, financialYear.id, user.id, issueA, customerA.id, item.id, 4, date);
  await createSaleEntry(company.id, financialYear.id, user.id, issueB, customerB.id, item.id, 2, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await salesReports.getOneCustomerSaleHistoryReport(context, { customerId: customerA.id });

  assert.ok(rows.some((r) => r.issueNo === issueA), "should include customerA sale");
  assert.equal(rows.some((r) => r.issueNo === issueB), false, "should exclude customerB sale");
  assert.ok(rows.every((r) => r.customerCode === customerA.code), "all rows should be for customerA");
});

test("one customer sale history requires customerId", async () => {
  const { company, financialYear, user } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  await assert.rejects(salesReports.getOneCustomerSaleHistoryReport(context, {}), /customerId is required/i);
});

test("sale return report includes filled and empty return records", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const customer = await createTestCustomer(company.id, seedCustomer);
  const returnNo = source("SR-RET");
  const date = "2027-03-11";

  await createReturnEntry(company.id, financialYear.id, user.id, returnNo, customer.id, item.id, 2, CylinderState.EMPTY, date);
  await createReturnEntry(company.id, financialYear.id, user.id, returnNo, customer.id, item.id, 1, CylinderState.FILLED, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await salesReports.getSaleReturnReport(context, { from: date, to: date });

  const row = rows.find((r) => r.returnNo === returnNo);
  assert.ok(row, "should find return row");
  assert.equal(row.emptyReturned, 2);
  assert.equal(row.filledReturned, 1);
  assert.equal(row.itemCode, item.code);
  assert.equal(row.customerCode, customer.code);
});

test("sale return report filters by customer", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const customerA = await createTestCustomer(company.id, seedCustomer, "SR-RETA");
  const customerB = await createTestCustomer(company.id, seedCustomer, "SR-RETB");
  const retA = source("SR-RETA-RET");
  const retB = source("SR-RETB-RET");
  const date = "2027-03-13";

  await createReturnEntry(company.id, financialYear.id, user.id, retA, customerA.id, item.id, 3, CylinderState.EMPTY, date);
  await createReturnEntry(company.id, financialYear.id, user.id, retB, customerB.id, item.id, 2, CylinderState.EMPTY, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await salesReports.getSaleReturnReport(context, { customerId: customerA.id });

  assert.ok(rows.some((r) => r.returnNo === retA));
  assert.equal(rows.some((r) => r.returnNo === retB), false);
});

test("invalid date filters are rejected", async () => {
  const { company, financialYear, user } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  await assert.rejects(salesReports.getSaleBetweenDatesReport(context, { from: "not-a-date" }), /from must be a valid date/i);
  await assert.rejects(salesReports.getSaleReturnReport(context, { from: "2027-03-20", to: "2027-03-10" }), /from must be before or equal to to/i);
});

test("unauthorized user is denied access to sales reports", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No SR Perm"), loginId: doc("no-sr-perm"), passwordHash: "test" },
  });
  cleanup.userIds.add(noPermUser.id);
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };

  await assert.rejects(salesReports.getSaleBetweenDatesReport(context, {}), /permission/i);
  await assert.rejects(salesReports.getSaleReturnReport(context, {}), /permission/i);
});

test("sale between dates CSV uses same filters and has correct headers", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem, "CSV-SR-ITEM");
  const customer = await createTestCustomer(company.id, seedCustomer, "CSV-SR-C");
  const issueNo = source("CSV-SR-SALE");
  const date = "2027-03-14";

  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 6, date);

  const request = await authedGet(user, `http://localhost/api/reports/sale-between-dates?format=csv&from=${date}&to=${date}`);
  const response = await saleBetweenDatesRoute.GET(request);
  const parsed = csvRows(await response.text());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.deepEqual(parsed[0], ["Issue No", "Date", "Customer Code", "Customer Name", "Total Qty", "Sale Amount", "Sale Type"]);
  const dataRow = parsed.find((r) => r[0] === issueNo);
  assert.ok(dataRow, "CSV should contain the sale row");
  assert.equal(dataRow[1], date);
  assert.equal(dataRow[4], "6");
});

test("sale return CSV has correct headers and data", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem, "CSV-RET-ITEM");
  const customer = await createTestCustomer(company.id, seedCustomer, "CSV-RET-C");
  const returnNo = source("CSV-RET");
  const date = "2027-03-15";

  await createReturnEntry(company.id, financialYear.id, user.id, returnNo, customer.id, item.id, 4, CylinderState.EMPTY, date);

  const request = await authedGet(user, `http://localhost/api/reports/sale-return?format=csv&from=${date}&to=${date}`);
  const response = await saleReturnRoute.GET(request);
  const parsed = csvRows(await response.text());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.deepEqual(parsed[0], ["Return No", "Date", "Customer Code", "Customer Name", "Item Code", "Item Name", "Filled Returned", "Empty Returned"]);
  const dataRow = parsed.find((r) => r[0] === returnNo);
  assert.ok(dataRow);
  assert.equal(dataRow[7], "4");
});
