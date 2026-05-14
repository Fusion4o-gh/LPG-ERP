import assert from "node:assert/strict";
import test from "node:test";
import { CylinderState, PermissionAction, PrismaClient, StockDirection, StockSourceType } from "@prisma/client";

const prisma = new PrismaClient();
const stockCylinderReports = await import("../src/server/services/reports/stock-cylinder-reports.ts");
const operationalReports = await import("../src/server/services/reports/operational-reports.ts");
const sessions = await import("../src/server/auth/session.ts");
const customerStockLedgerRoute = await import("../src/app/api/reports/customer-stock-ledger/route.ts");
const cylinderConversionRoute = await import("../src/app/api/reports/cylinder-conversion-between-dates/route.ts");

const cleanup = {
  stockSourceIds: new Set(),
  auditEntityIds: new Set(),
  customerIds: new Set(),
  itemIds: new Set(),
  userIds: new Set(),
  cylinderBalanceIds: new Set(),
};

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fixture() {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({ where: { companyId: company.id, isActive: true } });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  const seedItem = await prisma.item.findFirstOrThrow({ where: { companyId: company.id, code: "CYL-11.8-PSO" } });
  const seedCustomer = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id } });
  return { company, financialYear, user, seedItem, seedCustomer };
}

async function createTestItem(companyId, seedItem, prefix = "SCR-ITEM") {
  const item = await prisma.item.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Cylinder`, categoryId: seedItem.categoryId, brandId: seedItem.brandId },
  });
  cleanup.itemIds.add(item.id);
  return item;
}

async function createTestCustomer(companyId, seedCustomer, prefix = "SCR-CUST") {
  const customer = await prisma.customer.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Customer`, accountId: seedCustomer.accountId },
  });
  cleanup.customerIds.add(customer.id);
  return customer;
}

async function createStockEntry(companyId, financialYearId, userId, opts) {
  cleanup.stockSourceIds.add(opts.sourceId);
  return prisma.stockLedgerEntry.create({
    data: {
      companyId,
      financialYearId,
      itemId: opts.itemId,
      customerId: opts.customerId ?? null,
      cylinderState: opts.cylinderState ?? CylinderState.FILLED,
      direction: opts.direction,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
      transactionDate: new Date(opts.date),
      quantity: opts.quantity,
      balanceAfter: opts.balanceAfter ?? opts.quantity,
      remarks: opts.remarks ?? null,
      createdById: userId,
    },
  });
}

async function createConversionPair(companyId, financialYearId, userId, conversionNo, fromItemId, toItemId, qty, date, referenceNo) {
  cleanup.stockSourceIds.add(conversionNo);
  cleanup.auditEntityIds.add(conversionNo);
  await prisma.stockLedgerEntry.createMany({
    data: [
      {
        companyId,
        financialYearId,
        itemId: fromItemId,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.OUT,
        sourceType: StockSourceType.ADJUSTMENT,
        sourceId: conversionNo,
        transactionDate: new Date(date),
        quantity: qty,
        balanceAfter: 0,
        createdById: userId,
      },
      {
        companyId,
        financialYearId,
        itemId: toItemId,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.IN,
        sourceType: StockSourceType.ADJUSTMENT,
        sourceId: conversionNo,
        transactionDate: new Date(date),
        quantity: qty,
        balanceAfter: qty,
        createdById: userId,
      },
    ],
  });
  await prisma.auditLog.create({
    data: {
      companyId,
      userId,
      action: "CREATE",
      entityType: "CylinderConversion",
      entityId: conversionNo,
      after: { conversionNo, referenceNo: referenceNo ?? null, transactionDate: date, remarks: null, lines: [] },
    },
  });
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  if (cleanup.auditEntityIds.size) await prisma.auditLog.deleteMany({ where: { entityId: { in: [...cleanup.auditEntityIds] } } });
  if (cleanup.stockSourceIds.size) await prisma.stockLedgerEntry.deleteMany({ where: { sourceId: { in: [...cleanup.stockSourceIds] } } });
  if (cleanup.cylinderBalanceIds.size) await prisma.customerCylinderBalance.deleteMany({ where: { id: { in: [...cleanup.cylinderBalanceIds] } } });
  if (cleanup.customerIds.size) await prisma.customer.deleteMany({ where: { id: { in: [...cleanup.customerIds] } } });
  if (cleanup.itemIds.size) await prisma.item.deleteMany({ where: { id: { in: [...cleanup.itemIds] } } });
  if (cleanup.userIds.size) await prisma.session.deleteMany({ where: { userId: { in: [...cleanup.userIds] } } });
  if (cleanup.userIds.size) await prisma.user.deleteMany({ where: { id: { in: [...cleanup.userIds] } } });
  await prisma.$disconnect();
});

// ── Customer Stock Ledger ─────────────────────────────────────────────────────

test("customer stock ledger filters by customer", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const custA = await createTestCustomer(company.id, seedCustomer, "SCR-CA");
  const custB = await createTestCustomer(company.id, seedCustomer, "SCR-CB");
  const idA = doc("SCR-SL-A");
  const idB = doc("SCR-SL-B");
  const date = "2027-05-10";

  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: item.id, customerId: custA.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: idA, date, quantity: 5, balanceAfter: 5,
  });
  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: item.id, customerId: custB.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: idB, date, quantity: 3, balanceAfter: 3,
  });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await stockCylinderReports.getCustomerStockLedgerReport(context, { customerId: custA.id });

  assert.ok(rows.some((r) => r.documentNo === idA), "should include custA entry");
  assert.equal(rows.some((r) => r.documentNo === idB), false, "should exclude custB entry");
});

test("customer stock ledger filters by item and date range", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const itemA = await createTestItem(company.id, seedItem, "SCR-IA");
  const itemB = await createTestItem(company.id, seedItem, "SCR-IB");
  const cust = await createTestCustomer(company.id, seedCustomer);
  const idA = doc("SCR-SLI-A");
  const idB = doc("SCR-SLI-B");
  const idOut = doc("SCR-SLI-OUT");

  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: itemA.id, customerId: cust.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: idA, date: "2027-05-11", quantity: 4, balanceAfter: 4,
  });
  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: itemB.id, customerId: cust.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: idB, date: "2027-05-11", quantity: 2, balanceAfter: 2,
  });
  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: itemA.id, customerId: cust.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: idOut, date: "2027-04-01", quantity: 1, balanceAfter: 1,
  });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await stockCylinderReports.getCustomerStockLedgerReport(context, {
    customerId: cust.id, itemId: itemA.id, from: "2027-05-01", to: "2027-05-31",
  });

  assert.ok(rows.some((r) => r.documentNo === idA), "should include itemA in range");
  assert.equal(rows.some((r) => r.documentNo === idB), false, "should exclude itemB");
  assert.equal(rows.some((r) => r.documentNo === idOut), false, "should exclude out-of-range entry");
});

test("customer stock ledger requires customerId", async () => {
  const { company, financialYear, user } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  await assert.rejects(
    () => stockCylinderReports.getCustomerStockLedgerReport(context, {}),
    /customerId is required/,
  );
});

test("customer stock ledger shows correct sourceType label", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const cust = await createTestCustomer(company.id, seedCustomer);
  const saleId = doc("SCR-LBL-SALE");
  const returnId = doc("SCR-LBL-RET");
  const date = "2027-05-12";

  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: item.id, customerId: cust.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: saleId, date, quantity: 3, balanceAfter: 3,
  });
  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: item.id, customerId: cust.id, direction: StockDirection.IN,
    sourceType: StockSourceType.CYLINDER_RETURN, sourceId: returnId, date, quantity: 2, balanceAfter: 1,
  });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await stockCylinderReports.getCustomerStockLedgerReport(context, { customerId: cust.id, from: date, to: date });

  const saleRow = rows.find((r) => r.documentNo === saleId);
  const retRow = rows.find((r) => r.documentNo === returnId);
  assert.equal(saleRow?.sourceType, "Sale");
  assert.equal(retRow?.sourceType, "Return");
});

// ── Access Cylinders (Customer Cylinder Balances) ─────────────────────────────

test("access cylinders returns customer outstanding cylinders", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const cust = await createTestCustomer(company.id, seedCustomer);

  const balance = await prisma.customerCylinderBalance.create({
    data: { customerId: cust.id, itemId: item.id, emptyOwed: 7, filledOutstanding: 0 },
  });
  cleanup.cylinderBalanceIds.add(balance.id);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await operationalReports.getCustomerCylinderBalanceReport(context, { customerId: cust.id });

  const row = rows.find((r) => r.customer.id === cust.id && r.item.id === item.id);
  assert.ok(row, "should find customer balance row");
  assert.equal(row.outstandingEmptyCylinders, 7);
});

test("access cylinders filters by customer", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const custA = await createTestCustomer(company.id, seedCustomer, "SCR-ACC-A");
  const custB = await createTestCustomer(company.id, seedCustomer, "SCR-ACC-B");

  const balA = await prisma.customerCylinderBalance.create({
    data: { customerId: custA.id, itemId: item.id, emptyOwed: 4, filledOutstanding: 0 },
  });
  const balB = await prisma.customerCylinderBalance.create({
    data: { customerId: custB.id, itemId: item.id, emptyOwed: 2, filledOutstanding: 0 },
  });
  cleanup.cylinderBalanceIds.add(balA.id);
  cleanup.cylinderBalanceIds.add(balB.id);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await operationalReports.getCustomerCylinderBalanceReport(context, { customerId: custA.id });

  assert.ok(rows.some((r) => r.customer.id === custA.id));
  assert.equal(rows.some((r) => r.customer.id === custB.id), false);
});

// ── Cylinder Conversion B/W Date ──────────────────────────────────────────────

test("cylinder conversion report includes conversion entries", async () => {
  const { company, financialYear, user, seedItem } = await fixture();
  const itemA = await createTestItem(company.id, seedItem, "SCR-CONV-A");
  const itemB = await createTestItem(company.id, seedItem, "SCR-CONV-B");
  const convNo = doc("SCR-CONV");
  const date = "2027-05-13";

  await createConversionPair(company.id, financialYear.id, user.id, convNo, itemA.id, itemB.id, 6, date, "REF-001");

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await stockCylinderReports.getCylinderConversionReport(context, { from: date, to: date });

  const row = rows.find((r) => r.conversionNo === convNo);
  assert.ok(row, "should find conversion row");
  assert.equal(row.fromItemCode, itemA.code);
  assert.equal(row.toItemCode, itemB.code);
  assert.equal(row.fromQty, 6);
  assert.equal(row.toQty, 6);
  assert.equal(row.referenceNo, "REF-001");
  assert.equal(row.transactionDate, date);
});

test("cylinder conversion report excludes entries outside date range", async () => {
  const { company, financialYear, user, seedItem } = await fixture();
  const itemA = await createTestItem(company.id, seedItem, "SCR-CONV-DR-A");
  const itemB = await createTestItem(company.id, seedItem, "SCR-CONV-DR-B");
  const convNo = doc("SCR-CONV-DR");

  await createConversionPair(company.id, financialYear.id, user.id, convNo, itemA.id, itemB.id, 3, "2027-04-01");

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await stockCylinderReports.getCylinderConversionReport(context, { from: "2027-05-01", to: "2027-05-31" });

  assert.equal(rows.some((r) => r.conversionNo === convNo), false, "should exclude out-of-range conversion");
});

test("cylinder conversion report excludes ADJUSTMENT entries without audit log", async () => {
  const { company, financialYear, user, seedItem } = await fixture();
  const item = await createTestItem(company.id, seedItem, "SCR-CONV-NOLOG");
  const adjId = doc("SCR-ADJ-NOLOG");
  const date = "2027-05-14";

  // Create an ADJUSTMENT entry with no corresponding CylinderConversion audit log
  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: item.id, direction: StockDirection.IN,
    sourceType: StockSourceType.ADJUSTMENT, sourceId: adjId, date, quantity: 2, balanceAfter: 2,
  });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await stockCylinderReports.getCylinderConversionReport(context, { from: date, to: date });

  assert.equal(rows.some((r) => r.conversionNo === adjId), false, "should exclude ADJUSTMENT without audit log");
});

// ── Authorization ─────────────────────────────────────────────────────────────

test("unauthorized user is denied for customer stock ledger", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      loginId: doc("SCR-NOPERM"),
      name: "No Perm User",
      passwordHash: "x",
    },
  });
  cleanup.userIds.add(noPermUser.id);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };
  await assert.rejects(
    () => stockCylinderReports.getCustomerStockLedgerReport(context, { customerId: "any-id" }),
    /permission|forbidden|unauthorized/i,
  );
});

test("unauthorized user is denied for cylinder conversion report", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      loginId: doc("SCR-NOPERM2"),
      name: "No Perm User 2",
      passwordHash: "x",
    },
  });
  cleanup.userIds.add(noPermUser.id);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };
  await assert.rejects(
    () => stockCylinderReports.getCylinderConversionReport(context, {}),
    /permission|forbidden|unauthorized/i,
  );
});

// ── CSV ───────────────────────────────────────────────────────────────────────

test("customer stock ledger CSV uses same filters", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const custA = await createTestCustomer(company.id, seedCustomer, "SCR-CSV-A");
  const custB = await createTestCustomer(company.id, seedCustomer, "SCR-CSV-B");
  const idA = doc("SCR-CSV-SL-A");
  const idB = doc("SCR-CSV-SL-B");
  const date = "2027-05-15";

  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: item.id, customerId: custA.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: idA, date, quantity: 2, balanceAfter: 2,
  });
  await createStockEntry(company.id, financialYear.id, user.id, {
    itemId: item.id, customerId: custB.id, direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG, sourceId: idB, date, quantity: 1, balanceAfter: 1,
  });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const csv = await stockCylinderReports.getCustomerStockLedgerReportCsv(context, { customerId: custA.id });

  assert.ok(csv.includes(idA), "CSV should include custA document");
  assert.equal(csv.includes(idB), false, "CSV should exclude custB document");

  const lines = csv.trim().split(/\r?\n/);
  assert.equal(lines[0], "Date,Document No,Type,Item Code,Item Name,State,Direction,Quantity,Balance After,Remarks");
});

test("cylinder conversion CSV uses same filters", async () => {
  const { company, financialYear, user, seedItem } = await fixture();
  const itemA = await createTestItem(company.id, seedItem, "SCR-CCSV-A");
  const itemB = await createTestItem(company.id, seedItem, "SCR-CCSV-B");
  const convIn = doc("SCR-CCSV-IN");
  const convOut = doc("SCR-CCSV-OUT");

  await createConversionPair(company.id, financialYear.id, user.id, convIn, itemA.id, itemB.id, 5, "2027-05-16");
  await createConversionPair(company.id, financialYear.id, user.id, convOut, itemA.id, itemB.id, 4, "2027-04-01");

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const csv = await stockCylinderReports.getCylinderConversionReportCsv(context, { from: "2027-05-01", to: "2027-05-31" });

  assert.ok(csv.includes(convIn), "CSV should include in-range conversion");
  assert.equal(csv.includes(convOut), false, "CSV should exclude out-of-range conversion");

  const lines = csv.trim().split(/\r?\n/);
  assert.equal(lines[0], "Conversion No,Ref No,Date,From Item Code,From Item Name,From State,From Qty,To Item Code,To Item Name,To State,To Qty,Remarks");
});

// ── API Route (HTTP) ──────────────────────────────────────────────────────────

test("customer stock ledger route returns 400 when customerId missing", async () => {
  const { user } = await fixture();
  const req = await authedGet(user, "http://localhost/api/reports/customer-stock-ledger");
  const res = await customerStockLedgerRoute.GET(req);
  assert.equal(res.status, 400);
});

test("cylinder conversion route returns rows via HTTP", async () => {
  const { company, financialYear, user, seedItem } = await fixture();
  const itemA = await createTestItem(company.id, seedItem, "SCR-HTTP-A");
  const itemB = await createTestItem(company.id, seedItem, "SCR-HTTP-B");
  const convNo = doc("SCR-HTTP-CONV");
  const date = "2027-05-17";

  await createConversionPair(company.id, financialYear.id, user.id, convNo, itemA.id, itemB.id, 3, date);

  const req = await authedGet(user, `http://localhost/api/reports/cylinder-conversion-between-dates?from=${date}&to=${date}`);
  const res = await cylinderConversionRoute.GET(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(Array.isArray(body.rows));
  assert.ok(body.rows.some((r) => r.conversionNo === convNo));
});
