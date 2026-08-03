import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const service = await import("../src/server/services/plant/partial-receiving.ts");
test.after(async () => prisma.$disconnect());

test("partial receiving accumulates events and posts each receipt to stock", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("PRP"), name: doc("Partial Plant") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("PRL"), name: doc("Partial Tank"), type: "PLANT" } }); const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PRD"), name: doc("Partial Product") } });
  const row = await service.createPartialReceiving(context, { plantId: plant.id, locationId: location.id, productId: product.id, totalQuantity: 30, dispatchWeight: 30, transactionDate: "2099-01-05" }); assert.match(row.documentNo, /^PRC-/); assert.equal(row.remainingQuantity, "30");
  const first = await service.receivePartial(context, row.id, { quantityReceived: 12, receivedDate: "2099-01-05" }); assert.equal(first.receivedQuantity, "12"); assert.equal(first.remainingQuantity, "18"); assert.equal(first.arrivalStatus, "ARRIVED"); const complete = await service.receivePartial(context, row.id, { quantityReceived: 18, receivedDate: "2099-01-05" }); assert.equal(complete.receivedQuantity, "30"); assert.equal(complete.remainingQuantity, "0"); assert.equal(complete.arrivalStatus, "RECEIVED"); assert.equal(await prisma.partialReceivingEvent.count({ where: { partialReceivingId: row.id } }), 2); assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceType: "PARTIAL_RECEIVING", productId: product.id } }), 2);
});

test("partial receiving prevents receipts above remaining quantity", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("PRP2"), name: doc("Partial Plant 2") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("PRL2"), name: doc("Partial Tank 2"), type: "PLANT" } }); const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PRD2"), name: doc("Partial Product 2") } }); const row = await service.createPartialReceiving(context, { plantId: plant.id, locationId: location.id, productId: product.id, totalQuantity: 5, transactionDate: "2099-01-06" }); await assert.rejects(service.receivePartial(context, row.id, { quantityReceived: 6, receivedDate: "2099-01-06" }), /exceeds/i);
});
