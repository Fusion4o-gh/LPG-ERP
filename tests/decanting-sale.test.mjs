import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const decantingSales = await import("../src/server/services/sales/decanting-sale.ts");
const decantingSaleRoute = await import("../src/app/api/sale-purchase/decanting-sale/route.ts");
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
  const data = await isolatedFixture(prisma, "DS");
  await grant(data.user.id, "decanting-sales", [PermissionAction.CREATE, PermissionAction.PRINT]);
  return data;
}

async function seedFilledStock({ company, financialYear, user, item }, quantity = 10) {
  return prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "FILLED",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: doc("DS-OPEN"),
      transactionDate: new Date("2026-11-01"),
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

test("decanting sale creates one document number, source stock OUT, balanced voucher, and audit", async () => {
  const data = await fixture();
  const { company, financialYear, user, item, customer } = data;
  await seedFilledStock(data, 6);
  const issueNo = doc("DS-SVC");

  const result = await decantingSales.decantingSale({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    customerId: customer.id,
    sourceItemId: item.id,
    sourceQuantity: 1,
    decantedQuantity: 12.5,
    unitPrice: 200,
    transactionDate: "2026-11-02T10:30:00",
    remarks: "decanting sale",
  });

  assert.equal(result.issueNo, issueNo);
  assert.equal(result.stockEntries.length, 1);
  assert.equal(Number(result.totalAmount), 2500);
  assert.equal(Number(result.voucher.totalDebit), 2500);
  assert.equal(Number(result.voucher.totalCredit), 2500);

  const stockEntry = await prisma.stockLedgerEntry.findFirstOrThrow({ where: { sourceType: "SALE_LPG", sourceId: issueNo } });
  assert.equal(stockEntry.itemId, item.id);
  assert.equal(stockEntry.cylinderState, "FILLED");
  assert.equal(stockEntry.direction, "OUT");
  assert.equal(stockEntry.quantity, 1);

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: result.voucher.id }, include: { lines: true } });
  assert.equal(voucher.sourceType, "DecantingSale");
  assert.equal(voucher.sourceId, issueNo);


  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "DecantingSale", entityId: issueNo } });
  assert.equal(audit.after.sourceQuantity, 1);
  assert.equal(audit.after.decantedQuantity, "12.5");
  assert.equal(audit.after.lines[0].section, "Decanting");
});

test("printable decanting sale payload includes decanting details", async () => {
  const data = await fixture();
  const { user, item, customer } = data;
  await seedFilledStock(data, 5);

  const created = await decantingSaleRoute.POST(
    await authedJsonRequest(user, {
      customerId: customer.id,
      transactionDate: "2026-11-03T09:15:00",
      sourceItemId: item.id,
      sourceQuantity: 1,
      decantedQuantity: 10,
      unitPrice: 150,
      remarks: "print decanting",
    }),
  );
  const createdBody = await created.json();
  assert.equal(created.status, 200);

  const response = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "decanting-sale", documentNo: createdBody.issueNo }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.document.type, "Decanting Sale Document");
  assert.equal(body.document.number, createdBody.issueNo);
  assert.equal(body.document.partyLabel, "Customer");
  assert.equal(body.document.lineItems.length, 1);
  assert.equal(body.document.lineItems[0].section, "Decanting");
  assert.equal(body.document.lineItems[0].sourceQuantity, 1);
  assert.equal(body.document.lineItems[0].decantedQuantity, "10");
  assert.equal(body.document.totals.totalDebit, "1500");
});

test("decanting sale API accepts legacy-style payload", async () => {
  const data = await fixture();
  const { user, item, customer } = data;
  await seedFilledStock(data, 4);

  const response = await decantingSaleRoute.POST(
    await authedJsonRequest(user, {
      customerId: customer.id,
      date: "2026-11-04T08:00:00",
      itemId: item.id,
      quantity: 1,
      saleQuantity: 8,
      unitPrice: 100,
      remarks: "legacy decanting",
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.issueNo, /^DS-/);
  assert.equal(body.ids.stockEntryIds.length, 1);
  assert.ok(body.ids.voucherId);
});

test("decanting sale unauthorized user is denied before writes", async () => {
  const data = await isolatedFixture(prisma, "DS-DENY");
  const { company, financialYear, item, customer } = data;
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Decanting Sale Denied ${Date.now()}`,
      loginId: doc("ds-denied"),
      passwordHash: "test",
    },
  });
  const issueNo = doc("DS-DENIED");

  await assert.rejects(
    decantingSales.decantingSale({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: deniedUser.id,
      issueNo,
      customerId: customer.id,
      sourceItemId: item.id,
      sourceQuantity: 1,
      decantedQuantity: 5,
      unitPrice: 100,
      transactionDate: "2026-11-05",
    }),
    /permission/i,
  );

  assert.equal(await prisma.stockLedgerEntry.count({ where: { sourceId: issueNo } }), 0);
  assert.equal(await prisma.accountingVoucher.count({ where: { voucherNo: issueNo } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { entityId: issueNo } }), 0);
});

test("decanting sale closed-day guard is enforced", async () => {
  const data = await fixture();
  const { company, financialYear, user, item, customer } = data;
  await seedFilledStock(data, 3);
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
    decantingSales.decantingSale({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      issueNo: doc("DS-CLOSED"),
      customerId: customer.id,
      sourceItemId: item.id,
      sourceQuantity: 1,
      decantedQuantity: 5,
      unitPrice: 100,
      transactionDate: "1900-01-01",
    }),
    /closed day/i,
  );
});
