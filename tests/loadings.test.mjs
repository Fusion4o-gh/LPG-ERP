import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const contracts = await import("../src/server/services/import/import-contracts.ts");
const loadings = await import("../src/server/services/import/loadings.ts");

test.after(async () => prisma.$disconnect());

test("loading posts in-transit stock and supports cumulative partial receiving", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("LOAD-P"), name: doc("Loading Product") } });
  const transit = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("TRANSIT"), name: doc("Transit Location"), type: "IMPORT_TERMINAL" } });
  const destination = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DEST"), name: doc("Destination Location"), type: "PLANT" } });
  const secondDestination = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DEST2"), name: doc("Second Destination"), type: "PLANT" } });
  const contract = await contracts.createImportContract(context, { contractDate: "2026-08-02", importType: "SHIP", vendorId: base.seedVendor.id, productId: product.id, quantity: 100, rateUsd: 900, exchangeRate: 280 });
  const loading = await loadings.createLoading(context, { contractId: contract.id, loadingDate: "2099-01-01", stockLocationId: transit.id, quantityLoaded: 100, freight: 10 });
  assert.match(loading.loadingNo, /^LOAD-/); assert.equal(loading.shipmentStatus, "IN_TRANSIT");
  assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: loading.id, inTransit: true }, orderBy: { createdAt: "desc" } })).balanceAfter.toString(), "100");

  const partial = await loadings.receiveLoading(context, loading.id, { arrivalDate: "2099-01-01", arrivalLocationId: destination.id, arrivedQuantity: 40 });
  assert.equal(partial.arrivedQuantity, "40"); assert.equal(partial.shipmentStatus, "IN_TRANSIT");
  const complete = await loadings.receiveLoading(context, loading.id, { arrivalDate: "2099-01-01", arrivalLocationId: secondDestination.id, arrivedQuantity: 60 });
  assert.equal(complete.arrivedQuantity, "100"); assert.equal(complete.shipmentStatus, "RECEIVED");
  assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: loading.id, inTransit: true }, orderBy: { createdAt: "desc" } })).balanceAfter.toString(), "0");
  assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: loading.id, locationId: destination.id, inTransit: false } })).quantity.toString(), "40");
  assert.equal((await prisma.bulkStockLedgerEntry.findFirstOrThrow({ where: { sourceId: loading.id, locationId: secondDestination.id, inTransit: false } })).quantity.toString(), "60");
});

test("loading cannot exceed contract quantity or receive more than remaining quantity", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("LOAD-P2"), name: doc("Loading Product 2") } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("TRANSIT2"), name: doc("Transit Location 2"), type: "IMPORT_TERMINAL" } });
  const contract = await contracts.createImportContract(context, { contractDate: "2026-08-02", importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 10, rateUsd: 900, exchangeRate: 280 });
  await assert.rejects(loadings.createLoading(context, { contractId: contract.id, loadingDate: "2099-01-01", stockLocationId: location.id, quantityLoaded: 11 }), /exceeds/i);
  const loading = await loadings.createLoading(context, { contractId: contract.id, loadingDate: "2099-01-01", stockLocationId: location.id, quantityLoaded: 10 });
  await assert.rejects(loadings.receiveLoading(context, loading.id, { arrivalDate: "2099-01-01", arrivalLocationId: location.id, arrivedQuantity: 11 }), /exceed/i);
});
