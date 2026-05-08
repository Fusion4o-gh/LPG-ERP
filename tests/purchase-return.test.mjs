import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const purchases = await import("../src/server/services/purchases/purchase-filled-cylinder.ts");
const purchaseReturns = await import("../src/server/services/returns/purchase-return.ts");
const cylinderRoute = await import("../src/app/api/returns/purchase-return-cylinder/route.ts");
const otherRoute = await import("../src/app/api/returns/purchase-return-other/route.ts");
const documentRoute = await import("../src/app/api/transaction-documents/[documentType]/[documentNo]/route.ts");

async function fixture() {
  return isolatedFixture(prisma, "PRTN");
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

test("purchase return cylinder creates one return number, stock OUT entries, balanced vendor payable voucher, and aggregate totals", async () => {
  const { company, financialYear, user, item, seedItem, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("PRTN-CYL-ITEM"),
      name: "Purchase Return Cylinder Item",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PRTN-PUR"),
    vendorId: vendor.id,
    transactionDate: "2026-08-01",
    lines: [
      { itemId: item.id, quantity: 4, unitCost: 2000 },
      { itemId: secondItem.id, quantity: 2, unitCost: 1000 },
    ],
  });
  const returnNo = doc("PRTN-CYL");

  const result = await purchaseReturns.purchaseReturnCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    returnNo,
    vendorId: vendor.id,
    transactionDate: "2026-08-02",
    remarks: "multi-line purchase cylinder return",
    lines: [
      { itemId: item.id, quantity: 2, unitPrice: 2000, gstPercent: 10 },
      { itemId: secondItem.id, quantity: 1, unitPrice: 1000, gstPercent: 5 },
    ],
  });

  assert.equal(result.returnNo, returnNo);
  assert.equal(result.stockEntries.length, 2);
  assert.equal(Number(result.totalExGstAmount), 5000);
  assert.equal(Number(result.totalGstAmount), 450);
  assert.equal(Number(result.totalReturnAmount), 5450);
  assert.equal(Number(result.voucher.totalDebit), 5450);
  assert.equal(Number(result.voucher.totalCredit), 5450);

  const stockEntries = await prisma.stockLedgerEntry.findMany({ where: { sourceType: "PURCHASE_RETURN", sourceId: returnNo } });
  assert.equal(stockEntries.length, 2);
  assert.equal(stockEntries.every((entry) => entry.direction === "OUT" && entry.cylinderState === "FILLED"), true);

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: result.voucher.id }, include: { lines: true } });
  assert.equal(voucher.voucherNo, returnNo);
  assert.equal(voucher.lines.some((line) => Number(line.debit) === 5450), true);
  assert.equal(voucher.lines.some((line) => Number(line.credit) === 5000), true);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "PurchaseReturnCylinder", entityId: returnNo } });
  assert.equal(audit.after.lines.length, 2);
});

test("purchase return other creates a balanced voucher", async () => {
  const { company, financialYear, user, item, vendor } = await fixture();
  const returnNo = doc("PRTN-OTH");

  const result = await purchaseReturns.purchaseReturnOther({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    returnNo,
    vendorId: vendor.id,
    transactionDate: "2026-08-03",
    remarks: "other return",
    lines: [
      { itemId: item.id, description: "Accessory return", quantity: 2, unitPrice: 500, gstPercent: 10 },
      { itemId: item.id, description: "Loose material return", amount: 250, gstPercent: 0 },
    ],
  });

  assert.equal(result.returnNo, returnNo);
  assert.equal(Number(result.totalExGstAmount), 1250);
  assert.equal(Number(result.totalGstAmount), 100);
  assert.equal(Number(result.voucher.totalDebit), 1350);
  assert.equal(Number(result.voucher.totalCredit), 1350);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "PurchaseReturnOther", entityId: returnNo } });
  assert.equal(audit.after.lines.length, 2);
});

test("printable purchase return payload includes all lines and totals", async () => {
  const { company, financialYear, user, item, seedItem, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("PRTN-DOC-ITEM"),
      name: "Printable Purchase Return",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PRTN-DOC-PUR"),
    vendorId: vendor.id,
    transactionDate: "2026-08-04",
    lines: [
      { itemId: item.id, quantity: 2, unitCost: 2000 },
      { itemId: secondItem.id, quantity: 1, unitCost: 1000 },
    ],
  });
  const created = await cylinderRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      transactionDate: "2026-08-05",
      lines: [
        { itemId: item.id, quantity: 1, unitPrice: 2000, gstPercent: 10 },
        { itemId: secondItem.id, quantity: 1, unitPrice: 1000, gstPercent: 5 },
      ],
    }),
  );
  const createdBody = await created.json();
  assert.equal(created.status, 200);

  const response = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "purchase-return-cylinder", documentNo: createdBody.returnNo }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.document.type, "Purchase Return Cylinder Receipt");
  assert.equal(body.document.number, createdBody.returnNo);
  assert.equal(body.document.partyLabel, "Vendor");
  assert.equal(body.document.lineItems.length, 2);
  assert.equal(body.document.lineItems[0].returnType, "Cylinder");
  assert.equal(body.document.totals.totalDebit, "3250");
});

test("purchase return APIs accept legacy-style payloads", async () => {
  const { company, financialYear, user, item, vendor } = await fixture();
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PRTN-API-PUR"),
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 2,
    unitCost: 2000,
    transactionDate: "2026-08-06",
  });

  const cylinderResponse = await cylinderRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      date: "2026-08-07",
      itemId: item.id,
      quantity: 1,
      unitCost: 2000,
      gstPercent: 10,
      remarks: "legacy cylinder return",
    }),
  );
  const cylinderBody = await cylinderResponse.json();
  assert.equal(cylinderResponse.status, 200);
  assert.match(cylinderBody.returnNo, /^PRTN-/);
  assert.equal(cylinderBody.ids.stockEntryIds.length, 1);

  const otherResponse = await otherRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      date: "2026-08-07",
      returnType: "Other",
      lines: [{ itemId: item.id, description: "legacy other return", amount: 300, gstPercent: 5 }],
    }),
  );
  const otherBody = await otherResponse.json();
  assert.equal(otherResponse.status, 200);
  assert.match(otherBody.returnNo, /^PRTN-/);
  assert.ok(otherBody.ids.voucherId);
});

test("purchase return unauthorized user is denied", async () => {
  const { company, financialYear, item, vendor } = await fixture();
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Purchase Return Denied ${Date.now()}`,
      loginId: doc("prtn-denied"),
      passwordHash: "test",
    },
  });
  const returnNo = doc("PRTN-DENIED");

  await assert.rejects(
    purchaseReturns.purchaseReturnOther({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: deniedUser.id,
      returnNo,
      vendorId: vendor.id,
      itemId: item.id,
      amount: 100,
      transactionDate: "2026-08-08",
    }),
    /permission/i,
  );

  assert.equal(await prisma.accountingVoucher.count({ where: { voucherNo: returnNo } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { entityId: returnNo } }), 0);
});

test("purchase return closed-day guard is enforced", async () => {
  const { company, financialYear, item, vendor } = await fixture();
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Purchase Return Closed ${Date.now()}`,
      loginId: doc("prtn-closed"),
      passwordHash: "test",
    },
  });
  const role = await prisma.role.create({ data: { companyId: company.id, name: doc("prtn-role") } });
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
    purchaseReturns.purchaseReturnOther({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      returnNo: doc("PRTN-CLOSED"),
      vendorId: vendor.id,
      itemId: item.id,
      amount: 100,
      transactionDate: "1900-01-01",
    }),
    /closed day/i,
  );
});
