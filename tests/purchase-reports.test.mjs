import assert from "node:assert/strict";
import test from "node:test";
import { CylinderState, PermissionAction, PrismaClient, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { baseFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const purchaseReports = await import("../src/server/services/reports/purchase-reports.ts");
const sessions = await import("../src/server/auth/session.ts");
const vendorWiseRoute = await import("../src/app/api/reports/vendor-wise-receiving/route.ts");
const purchaseReturnRoute = await import("../src/app/api/reports/purchase-return/route.ts");

const cleanup = {
  stockSourceIds: new Set(),
  voucherNos: new Set(),
  auditEntityIds: new Set(),
  vendorIds: new Set(),
  itemIds: new Set(),
  userIds: new Set(),
};

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function source(id) {
  cleanup.stockSourceIds.add(id);
  return id;
}

function vno(id) {
  cleanup.voucherNos.add(id);
  return id;
}

function csvRows(csv) {
  return csv.trim().split(/\r?\n/).map((row) => row.split(","));
}

async function fixture() {
  const base = await baseFixture(prisma);
  return {
    company: base.company,
    financialYear: base.financialYear,
    user: base.user,
    seedItem: base.seedItem,
    seedVendor: base.seedVendor,
  };
}

async function createTestItem(companyId, seedItem, prefix = "PR-ITEM") {
  const item = await prisma.item.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Cylinder`, categoryId: seedItem.categoryId, brandId: seedItem.brandId },
  });
  cleanup.itemIds.add(item.id);
  return item;
}

async function createTestVendor(companyId, seedVendor, prefix = "PR-V") {
  const vendor = await prisma.vendor.create({
    data: { companyId, code: doc(prefix), name: `${prefix} Vendor`, accountId: seedVendor.accountId },
  });
  cleanup.vendorIds.add(vendor.id);
  return vendor;
}

async function createPurchaseEntry(companyId, financialYearId, userId, receiptNo, vendorId, itemId, quantity, date) {
  cleanup.stockSourceIds.add(receiptNo);
  await prisma.stockLedgerEntry.create({
    data: {
      companyId,
      financialYearId,
      itemId,
      vendorId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.IN,
      sourceType: StockSourceType.PURCHASE_FILLED,
      sourceId: receiptNo,
      transactionDate: new Date(date),
      quantity,
      balanceAfter: quantity,
      createdById: userId,
    },
  });
  await prisma.accountingVoucher.create({
    data: {
      companyId,
      financialYearId,
      voucherNo: receiptNo,
      voucherType: VoucherType.JV,
      voucherDate: new Date(date),
      sourceType: "PurchaseFilledCylinder",
      sourceId: receiptNo,
      totalDebit: quantity * 2000,
      totalCredit: quantity * 2000,
      createdById: userId,
    },
  });
  cleanup.voucherNos.add(receiptNo);
}

async function createReturnEntry(companyId, financialYearId, userId, returnNo, vendorId, itemId, quantity, date) {
  cleanup.stockSourceIds.add(returnNo);
  await prisma.stockLedgerEntry.create({
    data: {
      companyId,
      financialYearId,
      itemId,
      vendorId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.PURCHASE_RETURN,
      sourceId: returnNo,
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
      voucherNo: returnNo,
      voucherType: VoucherType.JV,
      voucherDate: new Date(date),
      sourceType: "PurchaseReturnCylinder",
      sourceId: returnNo,
      totalDebit: quantity * 2000,
      totalCredit: quantity * 2000,
      createdById: userId,
    },
  });
  cleanup.voucherNos.add(returnNo);
}

async function createOtherReturnVoucher(companyId, financialYearId, userId, returnNo, vendorId, amount, date) {
  cleanup.voucherNos.add(returnNo);
  await prisma.accountingVoucher.create({
    data: {
      companyId,
      financialYearId,
      voucherNo: returnNo,
      voucherType: VoucherType.JV,
      voucherDate: new Date(date),
      sourceType: "PurchaseReturnOther",
      sourceId: returnNo,
      totalDebit: amount,
      totalCredit: amount,
      createdById: userId,
    },
  });
  // Write minimal audit log so getPurchaseReturnReport can find vendorId
  cleanup.auditEntityIds.add(returnNo);
  await prisma.auditLog.create({
    data: {
      companyId,
      userId,
      action: "CREATE",
      entityType: "PurchaseReturnOther",
      entityId: returnNo,
      after: { returnNo, vendorId, totalReturnAmount: String(amount) },
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
  if (cleanup.voucherNos.size) await prisma.accountingVoucher.deleteMany({ where: { voucherNo: { in: [...cleanup.voucherNos] } } });
  if (cleanup.vendorIds.size) await prisma.vendor.deleteMany({ where: { id: { in: [...cleanup.vendorIds] } } });
  if (cleanup.itemIds.size) await prisma.item.deleteMany({ where: { id: { in: [...cleanup.itemIds] } } });
  if (cleanup.userIds.size) await prisma.session.deleteMany({ where: { userId: { in: [...cleanup.userIds] } } });
  if (cleanup.userIds.size) await prisma.user.deleteMany({ where: { id: { in: [...cleanup.userIds] } } });
  await prisma.$disconnect();
});

test("vendor wise receiving returns purchases in date range", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const vendor = await createTestVendor(company.id, seedVendor);
  const receiptNo = doc("PR-VWR");
  const date = "2027-04-10";

  await createPurchaseEntry(company.id, financialYear.id, user.id, receiptNo, vendor.id, item.id, 8, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await purchaseReports.getVendorWiseReceivingReport(context, { from: date, to: date });

  const row = rows.find((r) => r.receiptNo === receiptNo);
  assert.ok(row, "should find purchase row");
  assert.equal(row.transactionDate, date);
  assert.equal(row.vendorCode, vendor.code);
  assert.equal(row.vendorName, vendor.name);
  assert.equal(row.itemCode, item.code);
  assert.equal(row.quantity, 8);
  assert.ok(Number(row.purchaseAmount) > 0);
});

test("vendor wise receiving excludes purchases outside date range", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const vendor = await createTestVendor(company.id, seedVendor);
  const receiptNo = doc("PR-VWR-EXCL");

  await createPurchaseEntry(company.id, financialYear.id, user.id, receiptNo, vendor.id, item.id, 5, "2027-04-01");

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await purchaseReports.getVendorWiseReceivingReport(context, { from: "2027-04-10", to: "2027-04-20" });

  assert.equal(rows.some((r) => r.receiptNo === receiptNo), false);
});

test("vendor wise receiving filters by vendor", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const vendorA = await createTestVendor(company.id, seedVendor, "PR-VA");
  const vendorB = await createTestVendor(company.id, seedVendor, "PR-VB");
  const recA = doc("PR-VF-A");
  const recB = doc("PR-VF-B");
  const date = "2027-04-11";

  await createPurchaseEntry(company.id, financialYear.id, user.id, recA, vendorA.id, item.id, 4, date);
  await createPurchaseEntry(company.id, financialYear.id, user.id, recB, vendorB.id, item.id, 2, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await purchaseReports.getVendorWiseReceivingReport(context, { vendorId: vendorA.id });

  assert.ok(rows.some((r) => r.receiptNo === recA));
  assert.equal(rows.some((r) => r.receiptNo === recB), false);
  assert.ok(rows.filter((r) => r.receiptNo === recA).every((r) => r.vendorCode === vendorA.code));
});

test("vendor wise receiving filters by item", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const itemA = await createTestItem(company.id, seedItem, "PR-IA");
  const itemB = await createTestItem(company.id, seedItem, "PR-IB");
  const vendor = await createTestVendor(company.id, seedVendor);
  const recA = doc("PR-IF-A");
  const recB = doc("PR-IF-B");
  const date = "2027-04-12";

  await createPurchaseEntry(company.id, financialYear.id, user.id, recA, vendor.id, itemA.id, 3, date);
  await createPurchaseEntry(company.id, financialYear.id, user.id, recB, vendor.id, itemB.id, 6, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await purchaseReports.getVendorWiseReceivingReport(context, { itemId: itemA.id });

  assert.ok(rows.some((r) => r.receiptNo === recA));
  assert.equal(rows.some((r) => r.receiptNo === recB), false);
});

test("purchase return report includes cylinder return records", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const vendor = await createTestVendor(company.id, seedVendor);
  const returnNo = doc("PR-RET");
  const date = "2027-04-13";

  await createReturnEntry(company.id, financialYear.id, user.id, returnNo, vendor.id, item.id, 3, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await purchaseReports.getPurchaseReturnReport(context, { from: date, to: date });

  const row = rows.find((r) => r.returnNo === returnNo);
  assert.ok(row, "should find cylinder return row");
  assert.equal(row.vendorCode, vendor.code);
  assert.equal(row.itemCode, item.code);
  assert.equal(row.quantity, 3);
  assert.equal(row.returnType, "Cylinder");
  assert.ok(Number(row.returnAmount) > 0);
});

test("purchase return report includes other return records", async () => {
  const { company, financialYear, user, seedVendor } = await fixture();
  const vendor = await createTestVendor(company.id, seedVendor, "PR-OV");
  const returnNo = doc("PR-OTHER");
  const date = "2027-04-14";

  await createOtherReturnVoucher(company.id, financialYear.id, user.id, returnNo, vendor.id, 5000, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await purchaseReports.getPurchaseReturnReport(context, { from: date, to: date });

  const row = rows.find((r) => r.returnNo === returnNo);
  assert.ok(row, "should find other return row");
  assert.equal(row.returnType, "Other");
  assert.equal(Number(row.returnAmount), 5000);
});

test("purchase return report filters by vendor", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const item = await createTestItem(company.id, seedItem);
  const vendorA = await createTestVendor(company.id, seedVendor, "PR-RVA");
  const vendorB = await createTestVendor(company.id, seedVendor, "PR-RVB");
  const retA = doc("PR-RVRET-A");
  const retB = doc("PR-RVRET-B");
  const date = "2027-04-15";

  await createReturnEntry(company.id, financialYear.id, user.id, retA, vendorA.id, item.id, 2, date);
  await createReturnEntry(company.id, financialYear.id, user.id, retB, vendorB.id, item.id, 4, date);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const rows = await purchaseReports.getPurchaseReturnReport(context, { vendorId: vendorA.id });

  assert.ok(rows.some((r) => r.returnNo === retA));
  assert.equal(rows.some((r) => r.returnNo === retB), false);
});

test("invalid date filters are rejected for purchase reports", async () => {
  const { company, financialYear, user } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  await assert.rejects(purchaseReports.getVendorWiseReceivingReport(context, { from: "not-a-date" }), /from must be a valid date/i);
  await assert.rejects(purchaseReports.getPurchaseReturnReport(context, { from: "2027-04-20", to: "2027-04-10" }), /from must be before or equal to to/i);
});

test("unauthorized user is denied access to purchase reports", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No PR Perm"), loginId: doc("no-pr-perm"), passwordHash: "test" },
  });
  cleanup.userIds.add(noPermUser.id);
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };

  await assert.rejects(purchaseReports.getVendorWiseReceivingReport(context, {}), /permission/i);
  await assert.rejects(purchaseReports.getPurchaseReturnReport(context, {}), /permission/i);
});

test("vendor wise receiving CSV has correct headers and data", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const item = await createTestItem(company.id, seedItem, "CSV-PR-ITEM");
  const vendor = await createTestVendor(company.id, seedVendor, "CSV-PR-V");
  const receiptNo = doc("CSV-PR-REC");
  const date = "2027-04-16";

  await createPurchaseEntry(company.id, financialYear.id, user.id, receiptNo, vendor.id, item.id, 7, date);

  const request = await authedGet(user, `http://localhost/api/reports/vendor-wise-receiving?format=csv&from=${date}&to=${date}`);
  const response = await vendorWiseRoute.GET(request);
  const parsed = csvRows(await response.text());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.deepEqual(parsed[0], ["Receipt No", "Date", "Vendor Code", "Vendor Name", "Item Code", "Item Name", "Cylinder State", "Quantity", "Purchase Amount"]);
  const dataRow = parsed.find((r) => r[0] === receiptNo);
  assert.ok(dataRow, "CSV should contain the purchase row");
  assert.equal(dataRow[1], date);
  assert.equal(dataRow[7], "7");
});

test("purchase return CSV has correct headers", async () => {
  const { company, financialYear, user, seedItem, seedVendor } = await fixture();
  const item = await createTestItem(company.id, seedItem, "CSV-RET-ITEM");
  const vendor = await createTestVendor(company.id, seedVendor, "CSV-RET-V");
  const returnNo = doc("CSV-RET");
  const date = "2027-04-17";

  await createReturnEntry(company.id, financialYear.id, user.id, returnNo, vendor.id, item.id, 2, date);

  const request = await authedGet(user, `http://localhost/api/reports/purchase-return?format=csv&from=${date}&to=${date}`);
  const response = await purchaseReturnRoute.GET(request);
  const parsed = csvRows(await response.text());

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.deepEqual(parsed[0], ["Return No", "Date", "Vendor Code", "Vendor Name", "Item Code", "Item Name", "Quantity", "Return Type", "Return Amount"]);
  const dataRow = parsed.find((r) => r[0] === returnNo);
  assert.ok(dataRow);
  assert.equal(dataRow[7], "Cylinder");
});
