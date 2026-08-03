import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const opening = await import("../src/server/services/opening-balances/bulk-opening-stock.ts");
const partial = await import("../src/server/services/plant/partial-plant-sale.ts");
test.after(async () => prisma.$disconnect());

test("partial plant sale requires approval and posts stock/GL once on close", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  // Keep this fixture after any future day-close rows created by parallel tests.
  const transactionDate = "2099-01-01";
  const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("PPSP"), name: doc("Partial Plant") } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("PPSL"), name: doc("Partial Tank"), type: "PLANT" } });
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PPSPROD"), name: doc("Partial Product") } });
  await opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 30, valuationRate: 500, transactionDate });
  const row = await partial.createPartialPlantSale(context, { saleType: "BULK", plantId: plant.id, locationId: location.id, productId: product.id, customerId: base.seedCustomer.id, decantingWeight: 8, contractRate: 2000, orderAmount: 16000, transactionDate });
  assert.equal(row.saleStatus, "PENDING");
  await assert.rejects(partial.closePartialPlantSale(context, row.id), /approved before closing/);
  await partial.approvePartialPlantSale(context, row.id, true);
  const closed = await partial.closePartialPlantSale(context, row.id);
  assert.equal(closed.finalStatus, "CLOSE");
  assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: row.id, direction: "OUT" } }), 0);
  const posted = await partial.postPartialPlantSaleToPl(context, row.id);
  assert.ok(posted.voucherId);
  assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: row.id, direction: "OUT" } }), 1);
  assert.equal(await prisma.accountingVoucher.count({ where: { sourceId: row.id } }), 1);
  await assert.rejects(partial.postPartialPlantSaleToPl(context, row.id), /already posted/);
});
