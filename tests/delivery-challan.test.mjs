import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient, StockDirection, StockSourceType } from "@prisma/client";
import { doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const deliveryChallan = await import("../src/server/services/sales/delivery-challan.ts");
const sales = await import("../src/server/services/sales/sale-lpg.ts");

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
  const data = await isolatedFixture(prisma, "DC");
  await grant(data.user.id, "delivery-challan", [PermissionAction.CREATE, PermissionAction.VIEW, PermissionAction.DELETE, PermissionAction.PRINT]);
  await grant(data.user.id, "sale-lpg", [PermissionAction.CREATE, PermissionAction.VIEW, PermissionAction.PRINT]);
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
      sourceId: doc("DC-OPEN"),
      transactionDate: new Date("2026-11-01"),
      quantity,
      balanceAfter: quantity,
      createdById: user.id,
    },
  });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("delivery challan posts stock OUT and empty owed without AR voucher", async () => {
  const data = await fixture();
  await seedFilledStock(data, 8);
  const documentNo = doc("DC-1");

  const result = await prisma.$transaction((tx) =>
    deliveryChallan.createDeliveryChallan(tx, {
      companyId: data.company.id,
      financialYearId: data.financialYear.id,
      userId: data.user.id,
      documentNo,
      challanDate: "2026-11-10",
      customerId: data.customer.id,
      lines: [{ itemId: data.item.id, quantity: 3 }],
    }),
  );

  assert.equal(result.challan.documentNo, documentNo);
  assert.equal(result.challan.status, "DISPATCHED");
  assert.equal(result.stockEntries.length, 1);

  const stock = await prisma.stockLedgerEntry.findMany({
    where: { sourceType: StockSourceType.DELIVERY_CHALLAN, sourceId: documentNo },
  });
  assert.equal(stock.length, 1);
  assert.equal(stock[0].direction, StockDirection.OUT);
  assert.equal(stock[0].quantity, 3);

  const balance = await prisma.customerCylinderBalance.findUnique({
    where: { customerId_itemId: { customerId: data.customer.id, itemId: data.item.id } },
  });
  assert.equal(balance?.emptyOwed, 3);

  const voucher = await prisma.accountingVoucher.findFirst({
    where: { sourceId: documentNo },
  });
  assert.equal(voucher, null);
});

test("sale from delivery challan invoices without second stock OUT", async () => {
  const data = await fixture();
  await seedFilledStock(data, 10);
  const documentNo = doc("DC-2");

  const { challan } = await prisma.$transaction((tx) =>
    deliveryChallan.createDeliveryChallan(tx, {
      companyId: data.company.id,
      financialYearId: data.financialYear.id,
      userId: data.user.id,
      documentNo,
      challanDate: "2026-11-11",
      customerId: data.customer.id,
      lines: [{ itemId: data.item.id, quantity: 2 }],
    }),
  );

  const issueNo = doc("SI-DC");
  const sale = await sales.saleLpgSingle({
    companyId: data.company.id,
    financialYearId: data.financialYear.id,
    userId: data.user.id,
    issueNo,
    customerId: data.customer.id,
    transactionDate: "2026-11-12",
    deliveryChallanId: challan.id,
    lines: [{ itemId: data.item.id, quantity: 2, unitPrice: 1500, securityDepositAmount: 100 }],
  });

  assert.ok(sale.voucher);
  assert.equal(sale.stockEntries.filter((e) => e.direction === StockDirection.OUT && e.sourceType === StockSourceType.SALE_LPG).length, 0);

  const saleStock = await prisma.stockLedgerEntry.findMany({
    where: { sourceType: StockSourceType.SALE_LPG, sourceId: issueNo, direction: StockDirection.OUT },
  });
  assert.equal(saleStock.length, 0);

  const challanStock = await prisma.stockLedgerEntry.findMany({
    where: { sourceType: StockSourceType.DELIVERY_CHALLAN, sourceId: documentNo, direction: StockDirection.OUT },
  });
  assert.equal(challanStock.length, 1);
  assert.equal(challanStock[0].quantity, 2);

  const updated = await prisma.deliveryChallan.findUniqueOrThrow({ where: { id: challan.id } });
  assert.equal(updated.status, "INVOICED");
  assert.equal(updated.saleIssueNo, issueNo);

  const balance = await prisma.customerCylinderBalance.findUnique({
    where: { customerId_itemId: { customerId: data.customer.id, itemId: data.item.id } },
  });
  assert.equal(balance?.emptyOwed, 2);
  assert.equal(Number(balance?.securityHeld), 100);
});

test("cancel delivery challan reverses stock and empty owed", async () => {
  const data = await fixture();
  await seedFilledStock(data, 5);
  const documentNo = doc("DC-3");

  const { challan } = await prisma.$transaction((tx) =>
    deliveryChallan.createDeliveryChallan(tx, {
      companyId: data.company.id,
      financialYearId: data.financialYear.id,
      userId: data.user.id,
      documentNo,
      challanDate: "2026-11-13",
      customerId: data.customer.id,
      lines: [{ itemId: data.item.id, quantity: 2 }],
    }),
  );

  await prisma.$transaction((tx) =>
    deliveryChallan.cancelDeliveryChallan(tx, {
      companyId: data.company.id,
      financialYearId: data.financialYear.id,
      userId: data.user.id,
      id: challan.id,
      remarks: "test cancel",
    }),
  );

  const cancelled = await prisma.deliveryChallan.findUniqueOrThrow({ where: { id: challan.id } });
  assert.equal(cancelled.status, "CANCELLED");

  const balance = await prisma.customerCylinderBalance.findUnique({
    where: { customerId_itemId: { customerId: data.customer.id, itemId: data.item.id } },
  });
  assert.equal(balance?.emptyOwed, 0);

  const entries = await prisma.stockLedgerEntry.findMany({
    where: { sourceType: StockSourceType.DELIVERY_CHALLAN, sourceId: documentNo },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].direction, StockDirection.OUT);
  assert.equal(entries[1].direction, StockDirection.IN);
});
