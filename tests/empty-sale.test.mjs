import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { createIsolatedItem, doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const emptySales = await import("../src/server/services/sales/empty-sale.ts");
const emptySaleRoute = await import("../src/app/api/sale-purchase/empty-sale/route.ts");
const documentRoute = await import("../src/app/api/transaction-documents/[documentType]/[documentNo]/route.ts");

async function grant(userId, module, actions) {
  const userRole = await prisma.userRole.findFirstOrThrow({ where: { userId }, select: { roleId: true } });
  for (const action of actions) {
    const permission = await prisma.permission.upsert({
      where: { module_action: { module, action } },
      update: {},
      create: { module, action },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: userRole.roleId, permissionId: permission.id } },
      update: {},
      create: { roleId: userRole.roleId, permissionId: permission.id },
    });
  }
}

async function fixture() {
  const data = await isolatedFixture(prisma, "ES");
  await grant(data.user.id, "empty-sales", [PermissionAction.CREATE, PermissionAction.PRINT]);
  return data;
}

async function seedEmptyStock({ company, financialYear, user, item }, quantity = 10) {
  return prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "EMPTY",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: doc("ES-OPEN"),
      transactionDate: new Date("2026-10-01"),
      quantity,
      balanceAfter: quantity,
      createdById: user.id,
    },
  });
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

test("empty sale creates one issue number, per-line empty stock OUT, balanced customer receivable voucher, GST, and audit", async () => {
  const data = await fixture();
  const { company, financialYear, user, item, seedItem, customer } = data;
  const secondItem = await createIsolatedItem(prisma, company.id, seedItem, "ES-ITEM-2");
  await seedEmptyStock(data, 8);
  await seedEmptyStock({ ...data, item: secondItem }, 6);
  const issueNo = doc("ES-SVC");

  const result = await emptySales.emptySale({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    customerId: customer.id,
    transactionDate: "2026-10-02",
    remarks: "multi-line empty sale",
    lines: [
      { itemId: item.id, quantity: 2, unitPrice: 1000, gstPercent: 10 },
      { itemId: secondItem.id, quantity: 3, unitPrice: 500, gstPercent: 5 },
    ],
  });

  assert.equal(result.issueNo, issueNo);
  assert.equal(result.stockEntries.length, 2);
  assert.equal(Number(result.totalExGstAmount), 3500);
  assert.equal(Number(result.totalGstAmount), 275);
  assert.equal(Number(result.totalIncGstAmount), 3775);
  assert.equal(Number(result.voucher.totalDebit), 3775);
  assert.equal(Number(result.voucher.totalCredit), 3775);

  const stockEntries = await prisma.stockLedgerEntry.findMany({ where: { sourceType: "SALE_LPG", sourceId: issueNo } });
  assert.equal(stockEntries.length, 2);
  assert.equal(stockEntries.every((entry) => entry.direction === "OUT" && entry.cylinderState === "EMPTY"), true);
  assert.equal(stockEntries.find((entry) => entry.itemId === item.id)?.quantity, 2);
  assert.equal(stockEntries.find((entry) => entry.itemId === secondItem.id)?.quantity, 3);

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: result.voucher.id }, include: { lines: true } });
  assert.equal(voucher.sourceType, "EmptySale");
  assert.equal(voucher.sourceId, issueNo);
  assert.equal(voucher.lines.some((line) => Number(line.credit) === 275), true);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "EmptySale", entityId: issueNo } });
  assert.equal(audit.after.lines.length, 2);
  assert.equal(audit.after.lines[0].cylinderState, "EMPTY");
  assert.equal(audit.after.lines[0].direction, "OUT");
});

test("printable empty sale payload includes all lines", async () => {
  const data = await fixture();
  const { user, item, seedItem, company, customer } = data;
  const secondItem = await createIsolatedItem(prisma, company.id, seedItem, "ES-PRINT-ITEM");
  await seedEmptyStock(data, 5);
  await seedEmptyStock({ ...data, item: secondItem }, 5);

  const created = await emptySaleRoute.POST(
    await authedJsonRequest(user, {
      customerId: customer.id,
      transactionDate: "2026-10-03",
      lines: [
        { itemId: item.id, quantity: 1, unitPrice: 1000, gstPercent: 10 },
        { itemId: secondItem.id, quantity: 2, unitPrice: 500, gstPercent: 5 },
      ],
    }),
  );
  const createdBody = await created.json();
  assert.equal(created.status, 200);

  const response = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "empty-sale", documentNo: createdBody.issueNo }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.document.type, "Empty Sale Invoice");
  assert.equal(body.document.number, createdBody.issueNo);
  assert.equal(body.document.partyLabel, "Customer");
  assert.equal(body.document.lineItems.length, 2);
  assert.equal(body.document.lineItems.every((line) => line.cylinderState === "EMPTY" && line.direction === "OUT"), true);
  assert.equal(body.document.totals.totalDebit, "2150");
});

test("empty sale API accepts legacy-style payload", async () => {
  const data = await fixture();
  const { user, item, customer } = data;
  await seedEmptyStock(data, 4);

  const response = await emptySaleRoute.POST(
    await authedJsonRequest(user, {
      customerId: customer.id,
      date: "2026-10-04",
      itemId: item.id,
      quantity: 1,
      unitPrice: 700,
      gstPercent: 10,
      remarks: "legacy empty sale",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.issueNo, /^ES-/);
  assert.equal(body.ids.stockEntryIds.length, 1);
  assert.ok(body.ids.voucherId);
});

test("empty sale unauthorized user is denied before writes", async () => {
  const data = await isolatedFixture(prisma, "ES-DENY");
  const { company, financialYear, item, customer } = data;
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Empty Sale Denied ${Date.now()}`,
      loginId: doc("es-denied"),
      passwordHash: "test",
    },
  });
  const issueNo = doc("ES-DENIED");

  await assert.rejects(
    emptySales.emptySale({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: deniedUser.id,
      issueNo,
      customerId: customer.id,
      itemId: item.id,
      quantity: 1,
      unitPrice: 100,
      transactionDate: "2026-10-05",
    }),
    /permission/i,
  );

  assert.equal(await prisma.stockLedgerEntry.count({ where: { sourceId: issueNo } }), 0);
  assert.equal(await prisma.accountingVoucher.count({ where: { voucherNo: issueNo } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { entityId: issueNo } }), 0);
});

test("empty sale closed-day guard is enforced", async () => {
  const data = await fixture();
  const { company, financialYear, user, item, customer } = data;
  await seedEmptyStock(data, 3);
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
    emptySales.emptySale({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      issueNo: doc("ES-CLOSED"),
      customerId: customer.id,
      itemId: item.id,
      quantity: 1,
      unitPrice: 100,
      transactionDate: "1900-01-01",
    }),
    /closed day/i,
  );
});
