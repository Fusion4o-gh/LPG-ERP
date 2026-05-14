import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CylinderState, PermissionAction, PrismaClient, StockDirection, StockSourceType, VoucherType } from "@prisma/client";

const prisma = new PrismaClient();
const salesReports = await import("../src/server/services/reports/sales-reports.ts");
const sessions = await import("../src/server/auth/session.ts");
const salewiseProfitRoute = await import("../src/app/api/reports/salewise-profit/route.ts");

const cleanup = {
  stockSourceIds: new Set(),
  voucherNos: new Set(),
  customerIds: new Set(),
  itemIds: new Set(),
  userIds: new Set(),
};

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function src(prefix) {
  const id = doc(prefix);
  cleanup.stockSourceIds.add(id);
  return id;
}

function vno(id) {
  cleanup.voucherNos.add(id);
  return id;
}

async function fixture() {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({ where: { companyId: company.id, isActive: true } });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  const seedItem = await prisma.item.findFirstOrThrow({ where: { companyId: company.id, code: "CYL-11.8-PSO" } });
  const seedCustomer = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id, code: "C-0001" } });
  return { company, financialYear, user, seedItem, seedCustomer };
}

async function createItem(companyId, seedItem, prefix = "SWP-ITEM") {
  const item = await prisma.item.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Cylinder`, categoryId: seedItem.categoryId, brandId: seedItem.brandId },
  });
  cleanup.itemIds.add(item.id);
  return item;
}

async function createCustomer(companyId, seedCustomer, prefix = "SWP-C") {
  const customer = await prisma.customer.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Customer`, accountId: seedCustomer.accountId },
  });
  cleanup.customerIds.add(customer.id);
  return customer;
}

async function createPurchaseEntry(companyId, financialYearId, userId, receiptNo, itemId, quantity, amount, date) {
  vno(receiptNo);
  await prisma.stockLedgerEntry.create({
    data: {
      companyId, financialYearId, itemId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.IN,
      sourceType: StockSourceType.PURCHASE_FILLED,
      sourceId: receiptNo,
      transactionDate: new Date(date),
      quantity, balanceAfter: quantity, createdById: userId,
    },
  });
  await prisma.accountingVoucher.create({
    data: {
      companyId, financialYearId,
      voucherNo: receiptNo,
      voucherType: VoucherType.JV,
      voucherDate: new Date(date),
      sourceType: "PurchaseFilled",
      sourceId: receiptNo,
      totalDebit: amount,
      totalCredit: amount,
      createdById: userId,
    },
  });
}

async function createSaleEntry(companyId, financialYearId, userId, issueNo, customerId, itemId, quantity, amount, date) {
  vno(issueNo);
  await prisma.stockLedgerEntry.create({
    data: {
      companyId, financialYearId, itemId, customerId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.SALE_LPG,
      sourceId: issueNo,
      transactionDate: new Date(date),
      quantity, balanceAfter: 0, createdById: userId,
    },
  });
  await prisma.accountingVoucher.create({
    data: {
      companyId, financialYearId,
      voucherNo: issueNo,
      voucherType: VoucherType.SR,
      voucherDate: new Date(date),
      sourceType: "SaleLpg",
      sourceId: issueNo,
      totalDebit: amount,
      totalCredit: amount,
      createdById: userId,
    },
  });
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

// ── service tests ─────────────────────────────────────────────────────────────

test("salewise profit report returns sales in date range", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createItem(company.id, seedItem);
  const customer = await createCustomer(company.id, seedCustomer);
  const purchaseNo = src("SWP-PUR");
  const issueNo = src("SWP-SALE");

  // 10 units purchased at 1000 total → cost per unit = 100
  await createPurchaseEntry(company.id, financialYear.id, user.id, purchaseNo, item.id, 10, 1000, "2027-03-01");
  // 5 units sold at 900 total
  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 5, 900, "2027-03-10");

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const { rows } = await salesReports.getSalewiseProfitReport(ctx, { from: "2027-03-01", to: "2027-03-31" });

  const row = rows.find((r) => r.issueNo === issueNo);
  assert.ok(row, "must find the sale row");
  assert.equal(row.quantity, 5);
  assert.equal(row.customerName, customer.name);
  assert.equal(row.itemName, item.name);
  assert.equal(row.transactionDate, "2027-03-10");
});

test("salewise profit calculation returns expected values", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createItem(company.id, seedItem);
  const customer = await createCustomer(company.id, seedCustomer);
  const purchaseNo = src("SWP-CALC-PUR");
  const issueNo = src("SWP-CALC-SALE");

  // 10 units at 1000 → cost per unit = 100
  await createPurchaseEntry(company.id, financialYear.id, user.id, purchaseNo, item.id, 10, 1000, "2027-04-01");
  // 5 units at 900 → saleAmount=900, costAmount=5*100=500, profit=400, profit%=44.44
  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 5, 900, "2027-04-10");

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const { rows } = await salesReports.getSalewiseProfitReport(ctx, { from: "2027-04-01", to: "2027-04-30" });

  const row = rows.find((r) => r.issueNo === issueNo);
  assert.ok(row, "must find the sale row");
  assert.ok(Math.abs(row.saleAmount - 900) < 0.01, `saleAmount should be 900, got ${row.saleAmount}`);
  assert.ok(Math.abs(row.costAmount - 500) < 0.01, `costAmount should be 500, got ${row.costAmount}`);
  assert.ok(Math.abs(row.grossProfit - 400) < 0.01, `grossProfit should be 400, got ${row.grossProfit}`);
  assert.ok(row.profitPercent > 44 && row.profitPercent < 45, `profitPercent should be ~44.44, got ${row.profitPercent}`);
});

test("salewise profit date filtering excludes sales outside range", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createItem(company.id, seedItem);
  const customer = await createCustomer(company.id, seedCustomer);
  const purchaseNo = src("SWP-DATE-PUR");
  const insideNo = src("SWP-DATE-IN");
  const outsideNo = src("SWP-DATE-OUT");

  await createPurchaseEntry(company.id, financialYear.id, user.id, purchaseNo, item.id, 10, 1000, "2027-05-01");
  await createSaleEntry(company.id, financialYear.id, user.id, insideNo, customer.id, item.id, 2, 300, "2027-05-10");
  await createSaleEntry(company.id, financialYear.id, user.id, outsideNo, customer.id, item.id, 3, 450, "2027-05-25");

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const { rows } = await salesReports.getSalewiseProfitReport(ctx, { from: "2027-05-05", to: "2027-05-15" });

  assert.ok(rows.some((r) => r.issueNo === insideNo), "inside-range sale must appear");
  assert.ok(!rows.some((r) => r.issueNo === outsideNo), "outside-range sale must not appear");
});

test("salewise profit filters by customer", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createItem(company.id, seedItem);
  const customerA = await createCustomer(company.id, seedCustomer, "SWP-CA");
  const customerB = await createCustomer(company.id, seedCustomer, "SWP-CB");
  const purchaseNo = src("SWP-CF-PUR");
  const issueA = src("SWP-CF-A");
  const issueB = src("SWP-CF-B");

  await createPurchaseEntry(company.id, financialYear.id, user.id, purchaseNo, item.id, 10, 1000, "2027-06-01");
  await createSaleEntry(company.id, financialYear.id, user.id, issueA, customerA.id, item.id, 2, 300, "2027-06-10");
  await createSaleEntry(company.id, financialYear.id, user.id, issueB, customerB.id, item.id, 3, 450, "2027-06-11");

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const { rows } = await salesReports.getSalewiseProfitReport(ctx, { customerId: customerA.id });

  assert.ok(rows.some((r) => r.issueNo === issueA), "customer A sale must appear");
  assert.ok(!rows.some((r) => r.issueNo === issueB), "customer B sale must not appear");
});

test("salewise profit filters by item", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const itemA = await createItem(company.id, seedItem, "SWP-IA");
  const itemB = await createItem(company.id, seedItem, "SWP-IB");
  const customer = await createCustomer(company.id, seedCustomer);
  const purA = src("SWP-IF-PUR-A");
  const purB = src("SWP-IF-PUR-B");
  const issueA = src("SWP-IF-A");
  const issueB = src("SWP-IF-B");

  await createPurchaseEntry(company.id, financialYear.id, user.id, purA, itemA.id, 10, 1000, "2027-07-01");
  await createPurchaseEntry(company.id, financialYear.id, user.id, purB, itemB.id, 10, 1200, "2027-07-01");
  await createSaleEntry(company.id, financialYear.id, user.id, issueA, customer.id, itemA.id, 2, 300, "2027-07-10");
  await createSaleEntry(company.id, financialYear.id, user.id, issueB, customer.id, itemB.id, 2, 350, "2027-07-11");

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const { rows } = await salesReports.getSalewiseProfitReport(ctx, { itemId: itemA.id });

  assert.ok(rows.some((r) => r.issueNo === issueA), "item A sale must appear");
  assert.ok(!rows.some((r) => r.issueNo === issueB), "item B sale must not appear");
});

test("salewise profit rejects invalid date filters", async () => {
  const { company, financialYear, user } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  await assert.rejects(salesReports.getSalewiseProfitReport(ctx, { from: "not-a-date" }), /from must be a valid date/i);
});

test("unauthorized user is denied access to salewise profit", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "SWP No Perm", loginId: doc("swp-noperm"), passwordHash: "test" },
  });
  cleanup.userIds.add(noPermUser.id);
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };
  await assert.rejects(salesReports.getSalewiseProfitReport(ctx, {}), /permission/i);
});

// ── API route tests ───────────────────────────────────────────────────────────

test("salewise profit API returns rows for authorized user", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createItem(company.id, seedItem);
  const customer = await createCustomer(company.id, seedCustomer);
  const purchaseNo = src("SWP-API-PUR");
  const issueNo = src("SWP-API-SALE");

  await createPurchaseEntry(company.id, financialYear.id, user.id, purchaseNo, item.id, 10, 1000, "2027-08-01");
  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 3, 540, "2027-08-10");

  const req = await authedGet(user, `http://localhost/api/reports/salewise-profit?from=2027-08-01&to=2027-08-31`);
  const res = await salewiseProfitRoute.GET(req);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.rows));
  const row = body.rows.find((r) => r.issueNo === issueNo);
  assert.ok(row, "must include the posted sale row");
  assert.ok(typeof row.grossProfit === "number", "grossProfit must be a number");
  assert.ok(typeof row.profitPercent === "number", "profitPercent must be a number");
});

test("salewise profit API returns 400 for invalid date", async () => {
  const { user } = await fixture();
  const req = await authedGet(user, "http://localhost/api/reports/salewise-profit?from=bad-date");
  const res = await salewiseProfitRoute.GET(req);
  assert.equal(res.status, 400);
});

// ── CSV tests ─────────────────────────────────────────────────────────────────

test("salewise profit CSV has correct headers and includes profit data", async () => {
  const { company, financialYear, user, seedItem, seedCustomer } = await fixture();
  const item = await createItem(company.id, seedItem);
  const customer = await createCustomer(company.id, seedCustomer);
  const purchaseNo = src("SWP-CSV-PUR");
  const issueNo = src("SWP-CSV-SALE");

  await createPurchaseEntry(company.id, financialYear.id, user.id, purchaseNo, item.id, 10, 1000, "2027-09-01");
  await createSaleEntry(company.id, financialYear.id, user.id, issueNo, customer.id, item.id, 4, 720, "2027-09-10");

  const req = await authedGet(user, `http://localhost/api/reports/salewise-profit?from=2027-09-01&to=2027-09-30&format=csv`);
  const res = await salewiseProfitRoute.GET(req);
  const text = await res.text();

  assert.equal(res.headers.get("Content-Type"), "text/csv; charset=utf-8");
  assert.match(text, /Issue No.*Date.*Customer.*Item.*Qty.*Sale Amount.*Cost Amount.*Gross Profit.*Profit %/i);
  assert.match(text, /720\.00/, "CSV must include sale amount");
  assert.match(text, /400\.00/, "CSV must include cost amount (4 units * 100 cost/unit)");
});

// ── UI source tests ───────────────────────────────────────────────────────────

test("salewise profit page uses ReportTableClient with correct columns", async () => {
  const root = new URL("../", import.meta.url);
  const page = await readFile(new URL("src/app/(protected)/reports/salewise-profit/page.tsx", root), "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/, "page must not use ComingSoonPage");
  assert.match(page, /ReportTableClient/, "page must use ReportTableClient");
  assert.match(page, /showCustomerFilter/, "page must show customer filter");
  assert.match(page, /showItemFilter/, "page must show item filter");
  assert.match(page, /\/api\/reports\/salewise-profit/, "page must point to salewise-profit endpoint");
  assert.match(page, /grossProfit/, "page must display grossProfit column");
  assert.match(page, /profitPercent/, "page must display profitPercent column");
  assert.match(page, /saleAmount/, "page must display saleAmount column");
  assert.match(page, /costAmount/, "page must display costAmount column");
});
