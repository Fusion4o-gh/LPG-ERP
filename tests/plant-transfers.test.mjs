import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const opening = await import("../src/server/services/opening-balances/bulk-opening-stock.ts");
const transfers = await import("../src/server/services/plant/plant-transfers.ts");
test.after(async () => prisma.$disconnect());

test("plant transfer posts paired stock movements and preserves balances", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PT"), name: doc("Transfer Product") } }); const from = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("P1"), name: doc("Source Plant") } }); const to = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("P2"), name: doc("Destination Plant") } }); const fromLocation = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: from.id, code: doc("PTL1"), name: doc("Source Tank"), type: "PLANT" } }); const toLocation = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: to.id, code: doc("PTL2"), name: doc("Destination Tank"), type: "PLANT" } }); await opening.createBulkOpeningStock(context, { productId: product.id, locationId: fromLocation.id, quantity: 20, valuationRate: 500, transactionDate: "2026-08-02" });
  const row = await transfers.createPlantTransfer(context, { fromPlantId: from.id, toPlantId: to.id, fromLocationId: fromLocation.id, toLocationId: toLocation.id, productId: product.id, quantity: 7, transactionDate: "2026-08-02" });
  assert.match(row.documentNo, /^PT-/); assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: row.id } }), 2); assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: row.id, direction: "OUT" } })).quantity.toString(), "7"); assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: row.id, direction: "IN" } })).quantity.toString(), "7");
});

test("plant transfer rejects mismatched plant locations", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PT2"), name: doc("Transfer Product 2") } }); const from = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("P3"), name: doc("Source Plant 2") } }); const to = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("P4"), name: doc("Destination Plant 2") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: from.id, code: doc("PTL3"), name: doc("Source Tank 2"), type: "PLANT" } });
  await assert.rejects(transfers.createPlantTransfer(context, { fromPlantId: from.id, toPlantId: to.id, fromLocationId: location.id, toLocationId: location.id, productId: product.id, quantity: 1, transactionDate: "2026-08-02" }), /destination|invalid/i);
});
