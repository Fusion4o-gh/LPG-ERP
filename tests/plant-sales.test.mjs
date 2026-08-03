import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const opening = await import("../src/server/services/opening-balances/bulk-opening-stock.ts");
const sales = await import("../src/server/services/plant/plant-sales.ts");
test.after(async () => prisma.$disconnect());

test("plant bulk and filling sales post stock OUT and balanced customer vouchers", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("PSP"), name: doc("Plant Sale Plant") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("PSL"), name: doc("Plant Sale Tank"), type: "PLANT" } }); const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PSPROD"), name: doc("Plant Sale Product") } }); await opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 30, valuationRate: 500, transactionDate: "2026-08-02" });
  const bulk = await sales.createPlantSale(context, { saleType: "BULK", plantId: plant.id, locationId: location.id, customerId: base.seedCustomer.id, productId: product.id, quantity: 10, rate: 1800, transactionDate: "2026-08-02" }); assert.match(bulk.documentNo, /^PBS-/); assert.equal(bulk.amount, "18000");
  const filling = await sales.createPlantSale(context, { saleType: "FILLING", plantId: plant.id, locationId: location.id, customerId: base.seedCustomer.id, productId: product.id, quantity: 5, rate: 2000, transactionDate: "2026-08-02" }); assert.match(filling.documentNo, /^FS-/); assert.equal(filling.amount, "10000"); assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceType: "PLANT_SALE", direction: "OUT", productId: product.id } }), 2); const vouchers = await prisma.accountingVoucher.findMany({ where: { id: { in: [bulk.voucherId, filling.voucherId] } } }); assert.equal(vouchers.every((v) => v.totalDebit.equals(v.totalCredit)), true);
});
