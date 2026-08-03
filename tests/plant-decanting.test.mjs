import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const contracts = await import("../src/server/services/import/import-contracts.ts");
const loadings = await import("../src/server/services/import/loadings.ts");
const decanting = await import("../src/server/services/plant/plant-decanting.ts");
test.after(async () => prisma.$disconnect());

test("plant decanting moves in-transit bulk into a plant tank", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PDC"), name: doc("Decant Product") } }); const source = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("PDCSRC"), name: doc("Bowser Source"), type: "IMPORT_TERMINAL" } }); const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("PDCPLANT"), name: doc("Decant Plant") } }); const destination = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("PDCDEST"), name: doc("Plant Tank"), type: "PLANT" } }); const contract = await contracts.createImportContract(context, { contractDate: "2099-01-01", importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 10, rateUsd: 900, exchangeRate: 280 }); const loading = await loadings.createLoading(context, { contractId: contract.id, loadingDate: "2099-01-01", stockLocationId: source.id, quantityLoaded: 10 });
  const row = await decanting.createPlantDecanting(context, { plantId: plant.id, sourceLocationId: source.id, destinationLocationId: destination.id, productId: product.id, quantity: 6, rate: 900, transactionDate: "2099-01-01" }); assert.match(row.documentNo, /^PDC-/); assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: row.id } }), 2); assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: row.id, direction: "OUT" } })).inTransit, true); assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: row.id, direction: "IN" } })).plantId, plant.id); assert.equal(loading.shipmentStatus, "IN_TRANSIT");
});
