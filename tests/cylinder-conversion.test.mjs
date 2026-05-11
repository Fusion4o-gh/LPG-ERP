import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { createIsolatedItem, doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();

const conversions = await import("../src/server/services/inventory/cylinder-conversion.ts");
const conversionRoute = await import("../src/app/api/sale-purchase/cylinder-conversion/route.ts");
const transactionDocumentRoute = await import("../src/app/api/transaction-documents/[documentType]/[documentNo]/route.ts");
const sessions = await import("../src/server/auth/session.ts");

async function fixture() {
  const data = await isolatedFixture(prisma, "CC");
  await grant(data.user.id, "cylinder-conversions", [PermissionAction.CREATE, PermissionAction.PRINT]);
  return data;
}

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

async function seedFilledStock({ company, financialYear, user, item }, quantity = 10) {
  return prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "FILLED",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: doc("CC-OPEN"),
      transactionDate: new Date("2026-07-22"),
      quantity,
      balanceAfter: quantity,
      createdById: user.id,
    },
  });
}

async function authedRequest({ user }, body) {
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/sale-purchase/cylinder-conversion", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `lpg_erp_session=${session.sessionToken}`,
    },
    body: JSON.stringify(body),
  });
}

async function authedGetRequest({ user }, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, {
    headers: {
      cookie: `lpg_erp_session=${session.sessionToken}`,
    },
  });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("cylinder conversion creates one document number, stock OUT/IN, audit, and no voucher", async () => {
  const data = await fixture();
  const { company, financialYear, user, item, seedItem } = data;
  const toItem = await createIsolatedItem(prisma, company.id, seedItem, "CC-TO");
  await seedFilledStock(data, 8);

  const result = await conversions.cylinderConversion({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    conversionNo: doc("CC-SVC"),
    fromItemId: item.id,
    fromQuantity: 2,
    toItemId: toItem.id,
    toQuantity: 4,
    transactionDate: "2026-07-23",
    remarks: "Service conversion",
  });

  assert.equal(result.stockEntries.length, 2);
  const stockEntries = await prisma.stockLedgerEntry.findMany({ where: { sourceId: result.conversionNo }, orderBy: { direction: "desc" } });
  assert.equal(new Set(stockEntries.map((entry) => entry.sourceId)).size, 1);
  assert.equal(stockEntries.find((entry) => entry.itemId === item.id)?.direction, "OUT");
  assert.equal(stockEntries.find((entry) => entry.itemId === item.id)?.quantity, 2);
  assert.equal(stockEntries.find((entry) => entry.itemId === toItem.id)?.direction, "IN");
  assert.equal(stockEntries.find((entry) => entry.itemId === toItem.id)?.quantity, 4);

  const voucherCount = await prisma.accountingVoucher.count({ where: { sourceType: "CylinderConversion", sourceId: result.conversionNo } });
  assert.equal(voucherCount, 0);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "CylinderConversion", entityId: result.conversionNo } });
  assert.equal(audit.after.lines.length, 2);
  assert.equal(audit.after.lines[0].section, "From");
  assert.equal(audit.after.lines[1].section, "To");
});

test("cylinder conversion API accepts legacy-style payload and returns one conversion number", async () => {
  const data = await fixture();
  const { company, seedItem, item } = data;
  const toItem = await createIsolatedItem(prisma, company.id, seedItem, "CC-API-TO");
  await seedFilledStock(data, 5);

  const response = await conversionRoute.POST(
    await authedRequest(data, {
      date: "2026-07-24",
      remarks: "Legacy conversion",
      fromItem: item.id,
      fromQty: 1,
      toItem: toItem.id,
      toQty: 2,
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.conversionNo, /^CC-/);
  assert.equal(body.ids.stockEntryIds.length, 2);
});

test("printable cylinder conversion payload includes from/to lines", async () => {
  const data = await fixture();
  const { company, financialYear, user, seedItem, item } = data;
  const toItem = await createIsolatedItem(prisma, company.id, seedItem, "CC-PRINT-TO");
  await seedFilledStock(data, 5);
  const conversionNo = doc("CC-PRINT");

  await conversions.cylinderConversion({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    conversionNo,
    fromItemId: item.id,
    fromQuantity: 1,
    toItemId: toItem.id,
    toQuantity: 2,
    transactionDate: "2026-07-25",
  });

  const response = await transactionDocumentRoute.GET(await authedGetRequest(data, `http://localhost/api/transaction-documents/cylinder-conversion/${conversionNo}`), {
    params: Promise.resolve({ documentType: "cylinder-conversion", documentNo: conversionNo }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.document.type, "Cylinder Conversion Document");
  assert.deepEqual(
    body.document.lineItems.map((line) => line.section),
    ["From", "To"],
  );
});

test("unauthorized user is denied before cylinder conversion writes", async () => {
  const data = await isolatedFixture(prisma, "CC-DENY");
  const { company, financialYear, item, seedItem } = data;
  const toItem = await createIsolatedItem(prisma, company.id, seedItem, "CC-DENY-TO");
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Denied Conversion ${Date.now()}`,
      loginId: doc("cc-denied"),
      passwordHash: "test",
    },
  });

  await assert.rejects(
    conversions.cylinderConversion({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: deniedUser.id,
      conversionNo: doc("CC-DENIED"),
      fromItemId: item.id,
      fromQuantity: 1,
      toItemId: toItem.id,
      toQuantity: 1,
      transactionDate: "2026-07-26",
    }),
    /permission/i,
  );
});

test("closed-day guard blocks cylinder conversion writes", async () => {
  const data = await fixture();
  const { company, financialYear, user, item, seedItem } = data;
  const toItem = await createIsolatedItem(prisma, company.id, seedItem, "CC-CLOSED-TO");
  await seedFilledStock(data, 5);
  await prisma.dayClosing.upsert({
    where: { companyId_closedDate: { companyId: company.id, closedDate: new Date("2026-07-01") } },
    update: {},
    create: {
      companyId: company.id,
      financialYearId: financialYear.id,
      closedDate: new Date("2026-07-01"),
      closedById: user.id,
    },
  });

  await assert.rejects(
    conversions.cylinderConversion({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      conversionNo: doc("CC-CLOSED"),
      fromItemId: item.id,
      fromQuantity: 1,
      toItemId: toItem.id,
      toQuantity: 1,
      transactionDate: "2026-06-30",
    }),
    /closed day/i,
  );
});
