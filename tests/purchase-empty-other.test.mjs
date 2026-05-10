import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const purchases = await import("../src/server/services/purchases/purchase-empty-other.ts");
const emptyRoute = await import("../src/app/api/purchases/empty-cylinder/route.ts");
const otherRoute = await import("../src/app/api/purchases/other/route.ts");
const documentRoute = await import("../src/app/api/transaction-documents/[documentType]/[documentNo]/route.ts");

async function fixture() {
  return isolatedFixture(prisma, "PEO");
}

async function authedJsonRequest(user, body) {
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: JSON.stringify(body),
  });
}

async function authedRequest(user) {
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/test", {
    headers: { cookie: `lpg_erp_session=${session.sessionToken}` },
  });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("purchase empty creates one receipt number, EMPTY stock IN, balanced vendor payable voucher, and aggregate totals", async () => {
  const { company, financialYear, user, item, seedItem, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("PEO-EMPTY-ITEM"),
      name: "Purchase Empty Item",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  const receiptNo = doc("PEO-EMPTY");

  const result = await purchases.purchaseEmptyCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    receiptNo,
    vendorId: vendor.id,
    transactionDate: "2026-09-01",
    remarks: "multi-line empty purchase",
    lines: [
      { itemId: item.id, quantity: 3, unitPrice: 1000, gstPercent: 10 },
      { itemId: secondItem.id, quantity: 2, unitPrice: 500, gstPercent: 5 },
    ],
  });

  assert.equal(result.receiptNo, receiptNo);
  assert.equal(result.stockEntries.length, 2);
  assert.equal(Number(result.totalExGstAmount), 4000);
  assert.equal(Number(result.totalGstAmount), 350);
  assert.equal(Number(result.totalIncGstAmount), 4350);
  assert.equal(Number(result.voucher.totalDebit), 4350);
  assert.equal(Number(result.voucher.totalCredit), 4350);

  const stockEntries = await prisma.stockLedgerEntry.findMany({ where: { sourceType: "PURCHASE_FILLED", sourceId: receiptNo } });
  assert.equal(stockEntries.length, 2);
  assert.equal(stockEntries.every((entry) => entry.direction === "IN" && entry.cylinderState === "EMPTY"), true);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "PurchaseEmptyCylinder", entityId: receiptNo } });
  assert.equal(audit.after.lines.length, 2);
});

test("purchase other creates a balanced voucher without stock ledger by default", async () => {
  const { company, financialYear, user, item, vendor } = await fixture();
  const receiptNo = doc("PEO-OTHER");

  const result = await purchases.purchaseOther({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    receiptNo,
    vendorId: vendor.id,
    transactionDate: "2026-09-02",
    remarks: "other purchase",
    lines: [
      { itemId: item.id, description: "Accessory purchase", quantity: 2, unitPrice: 500, gstPercent: 10 },
      { description: "Loose expense", amount: 250, gstPercent: 0 },
    ],
  });

  assert.equal(result.receiptNo, receiptNo);
  assert.equal(result.stockEntries.length, 0);
  assert.equal(Number(result.totalExGstAmount), 1250);
  assert.equal(Number(result.totalGstAmount), 100);
  assert.equal(Number(result.voucher.totalDebit), 1350);
  assert.equal(Number(result.voucher.totalCredit), 1350);
  assert.equal(await prisma.stockLedgerEntry.count({ where: { sourceId: receiptNo } }), 0);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "PurchaseOther", entityId: receiptNo } });
  assert.equal(audit.after.lines.length, 2);
});

test("printable purchase payload includes all lines and totals", async () => {
  const { user, item, seedItem, company, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("PEO-DOC-ITEM"),
      name: "Printable Purchase Empty",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });

  const created = await emptyRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      transactionDate: "2026-09-03",
      lines: [
        { itemId: item.id, quantity: 1, unitPrice: 1000, gstPercent: 10 },
        { itemId: secondItem.id, quantity: 1, unitPrice: 500, gstPercent: 5 },
      ],
    }),
  );
  const createdBody = await created.json();
  assert.equal(created.status, 200);

  const response = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "purchase-empty-cylinder", documentNo: createdBody.receiptNo }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.document.type, "Purchase Empty Cylinder Receipt");
  assert.equal(body.document.number, createdBody.receiptNo);
  assert.equal(body.document.partyLabel, "Vendor");
  assert.equal(body.document.lineItems.length, 2);
  assert.equal(body.document.lineItems[0].cylinderState, "EMPTY");
  assert.equal(body.document.totals.totalDebit, "1625");
});

test("purchase empty and purchase other APIs accept legacy-style payloads", async () => {
  const { user, item, vendor } = await fixture();

  const emptyResponse = await emptyRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      date: "2026-09-04",
      itemId: item.id,
      quantity: 1,
      unitCost: 700,
      gstPercent: 10,
      remarks: "legacy empty purchase",
    }),
  );
  const emptyBody = await emptyResponse.json();
  assert.equal(emptyResponse.status, 200);
  assert.match(emptyBody.receiptNo, /^PR-/);
  assert.equal(emptyBody.ids.stockEntryIds.length, 1);

  const otherResponse = await otherRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      date: "2026-09-04",
      description: "legacy other purchase",
      amount: 300,
      gstPercent: 5,
    }),
  );
  const otherBody = await otherResponse.json();
  assert.equal(otherResponse.status, 200);
  assert.match(otherBody.receiptNo, /^PR-/);
  assert.ok(otherBody.ids.voucherId);
});

test("purchase empty and purchase other unauthorized users are denied", async () => {
  const { company, financialYear, item, vendor } = await fixture();
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Purchase Empty Other Denied ${Date.now()}`,
      loginId: doc("peo-denied"),
      passwordHash: "test",
    },
  });
  const receiptNo = doc("PEO-DENIED");

  await assert.rejects(
    purchases.purchaseEmptyCylinder({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: deniedUser.id,
      receiptNo,
      vendorId: vendor.id,
      itemId: item.id,
      quantity: 1,
      unitPrice: 100,
      transactionDate: "2026-09-05",
    }),
    /permission/i,
  );

  assert.equal(await prisma.stockLedgerEntry.count({ where: { sourceId: receiptNo } }), 0);
  assert.equal(await prisma.accountingVoucher.count({ where: { voucherNo: receiptNo } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { entityId: receiptNo } }), 0);
});

test("purchase empty and purchase other closed-day guard is enforced", async () => {
  const { company, financialYear, item, vendor } = await fixture();
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Purchase Empty Other Closed ${Date.now()}`,
      loginId: doc("peo-closed"),
      passwordHash: "test",
    },
  });
  const role = await prisma.role.create({ data: { companyId: company.id, name: doc("peo-role") } });
  const permission = await prisma.permission.findUniqueOrThrow({
    where: { module_action: { module: "purchase-filled-cylinders", action: PermissionAction.CREATE } },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  await prisma.dayClosing.upsert({
    where: { companyId_closedDate: { companyId: company.id, closedDate: new Date("1900-01-02") } },
    update: {},
    create: {
      companyId: company.id,
      financialYearId: financialYear.id,
      closedDate: new Date("1900-01-02"),
      closedById: user.id,
    },
  });

  await assert.rejects(
    purchases.purchaseOther({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      receiptNo: doc("PEO-CLOSED"),
      vendorId: vendor.id,
      itemId: item.id,
      amount: 100,
      transactionDate: "1900-01-01",
    }),
    /closed day/i,
  );
});
