import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const opening = await import("../src/server/services/opening-balances/bulk-opening-stock.ts");
const imports = await import("../src/server/services/import/import-contracts.ts");
const reports = await import("../src/server/services/reports/bulk-reports.ts");
const bulkLedger = await import("../src/server/services/inventory/bulk-stock-ledger.ts");
test.after(async () => prisma.$disconnect());

test("bulk stock ledger and all-contract summary expose implemented transactions", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("BR"), name: doc("Bulk Report Product") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("BRLOC"), name: doc("Bulk Report Location"), type: "PLANT" } }); await opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 12, valuationRate: 500, transactionDate: "2026-08-02" }); const contract = await imports.createImportContract(context, { contractDate: "2026-08-02", importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 10, rateUsd: 900, exchangeRate: 280 });
  const ledger = await reports.getBulkStockLedgerReport(context, { productId: product.id, locationId: location.id }); assert.ok(ledger.rows.some((row) => row.sourceType === "OPENING_STOCK")); const csv = await reports.getBulkStockLedgerReportCsv(context, { productId: product.id }); assert.match(csv, /Date,Product,Location/); const summary = await reports.getAllContractSummary(context); assert.ok(summary.rows.some((row) => row.contractNo === contract.contractNo && row.contractType === "IMPORT_TAFTAN")); assert.match(await reports.getAllContractSummaryCsv(context), /Contract No,Date,Type,Quantity,Delivered,Amount,Status/);
});

test("bulk opening stock is blocked after live bulk movement exists", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("BR-LOCK"), name: "Bulk Opening Lock Product" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("BR-LOCK-LOC"), name: "Bulk Opening Lock Location", type: "PLANT" } });
  await bulkLedger.createBulkStockLedgerEntry(prisma, { ...context, productId: product.id, locationId: location.id, direction: "IN", quantity: 1, unit: "MT", sourceType: "LOCAL_PURCHASE", sourceId: doc("BR-LOCK-MOVE"), transactionDate: "2026-08-02", createdById: base.user.id });
  await assert.rejects(
    opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 2, valuationRate: 500, transactionDate: "2026-08-02" }),
    /before live bulk movement/i,
  );
});

test("import contract and loading reports reconcile loaded and remaining quantities", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("BR2"), name: doc("Bulk Report Product 2") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("BRLOC2"), name: doc("Bulk Report Location 2"), type: "IMPORT_TERMINAL" } }); const contracts = await import("../src/server/services/import/import-contracts.ts"); const loadings = await import("../src/server/services/import/loadings.ts"); const contract = await contracts.createImportContract(context, { contractDate: "2099-01-01", importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 20, rateUsd: 900, exchangeRate: 280 }); await loadings.createLoading(context, { contractId: contract.id, loadingDate: "2099-01-01", stockLocationId: location.id, quantityLoaded: 12 });
  const summary = await reports.getImportContractSummary(context, "TAFTAN"); const row = summary.rows.find((entry) => entry.contractNo === contract.contractNo); assert.equal(row?.loadedQuantity, "12"); assert.equal(row?.remainingQuantity, "8"); assert.match(await reports.getImportContractSummaryCsv(context, "TAFTAN"), /Contract No,Date,Import Type,Quantity,Loaded,Arrived,Remaining,Status,USD Amount,PKR Amount/); const loadingReport = await reports.getLoadingReport(context, true); assert.ok(loadingReport.rows.some((entry) => entry.contractNo === contract.contractNo)); assert.match(await reports.getLoadingReportCsv(context, true), /Loading No,Date,Contract No,Import Type,Product,Loaded,Arrived,Remaining,Status,Location/);
  const register = await reports.getTaftanImportRegisterReport(context, { from: "2099-01-01", to: "2099-01-31", productId: product.id, locationId: location.id }); assert.equal(register.rows.length, 1); assert.equal(register.rows[0].quantityLoaded, "12");
  const purchaseSale = await reports.getTaftanPurchaseSaleReport(context, { from: "2099-01-01", to: "2099-01-31", productId: product.id, locationId: location.id }); assert.equal(purchaseSale.rows.length, 1); assert.equal(purchaseSale.rows[0].purchasedQuantity, "12"); assert.equal(purchaseSale.rows[0].soldQuantity, "0");
});

test("quantitative reconciliation and consumption reports reconcile bulk movements", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("QREC"), name: "Quantitative Product" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("QLOC"), name: "Quantitative Location", type: "PLANT" } });
  await opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 100, valuationRate: 500, transactionDate: "2026-07-01" });
  await bulkLedger.createBulkStockLedgerEntry(prisma, { ...context, productId: product.id, locationId: location.id, direction: "IN", quantity: 20, unit: "MT", sourceType: "LOCAL_PURCHASE", sourceId: doc("Q-IN"), transactionDate: "2026-08-01", createdById: base.user.id });
  await bulkLedger.createBulkStockLedgerEntry(prisma, { ...context, productId: product.id, locationId: location.id, direction: "OUT", quantity: 30, unit: "MT", sourceType: "PLANT_SALE", sourceId: doc("Q-OUT"), transactionDate: "2026-08-02", createdById: base.user.id });
  await bulkLedger.createBulkStockLedgerEntry(prisma, { ...context, productId: product.id, locationId: location.id, direction: "IN", quantity: 40, unit: "MT", inTransit: true, sourceType: "LOADING", sourceId: doc("Q-TRANSIT-IN"), transactionDate: "2026-08-02", createdById: base.user.id });
  await bulkLedger.createBulkStockLedgerEntry(prisma, { ...context, productId: product.id, locationId: location.id, direction: "OUT", quantity: 10, unit: "MT", inTransit: true, sourceType: "IMPORT_ARRIVAL", sourceId: doc("Q-TRANSIT-OUT"), transactionDate: "2026-08-03", createdById: base.user.id });

  const reconciliation = await reports.getQuantitativeReconciliationReport(context, { from: "2026-08-01", to: "2026-08-31", productId: product.id, locationId: location.id });
  const row = reconciliation.rows[0];
  assert.equal(row.openingQuantity, "100");
  assert.equal(row.receivedQuantity, "20");
  assert.equal(row.issuedQuantity, "30");
  assert.equal(row.closingQuantity, "90");
  assert.equal(row.inTransitQuantity, "30");

  const consumption = await reports.getConsumptionReport(context, { from: "2026-08-01", to: "2026-08-31", productId: product.id, locationId: location.id });
  assert.equal(consumption.rows.length, 1);
  assert.equal(consumption.rows[0].sourceType, "PLANT_SALE");
  assert.equal(consumption.rows[0].quantityConsumed, "30");

  const csv = await reports.getQuantitativeReconciliationReportCsv(context, { productId: product.id });
  assert.match(csv, /Product Code,Product,Location,Opening,Received,Issued,Closing,In Transit/);
});

test("CMR difference and import cost sheet reconcile loading and arrival values", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("CMR"), name: "CMR Product" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("CMRLOC"), name: "CMR Location", type: "IMPORT_TERMINAL" } });
  const contracts = await import("../src/server/services/import/import-contracts.ts");
  const loadings = await import("../src/server/services/import/loadings.ts");
  const contract = await contracts.createImportContract(context, { contractDate: "2098-01-01", importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 100, rateUsd: 900, exchangeRate: 280 });
  const loading = await loadings.createLoading(context, { contractId: contract.id, loadingDate: "2098-01-02", stockLocationId: location.id, quantityLoaded: 80, rate: 100, freight: 5 });
  await loadings.receiveLoading(context, loading.id, { arrivalDate: "2098-01-03", arrivalLocationId: location.id, arrivedQuantity: 60 });

  const cmr = await reports.getCmrDifferenceReport(context, { from: "2098-01-01", to: "2098-01-31", productId: product.id, importType: "TAFTAN" });
  assert.equal(cmr.rows[0].quantityLoaded, "80");
  assert.equal(cmr.rows[0].cmrQuantity, "60");
  assert.equal(cmr.rows[0].difference, "-20");
  const cost = await reports.getImportCostSheetReport(context, { productId: product.id });
  assert.equal(cost.rows[0].totalFreight, "400");
  assert.equal(cost.rows[0].totalCost, "8400");
  assert.equal(cost.rows[0].arrivedCost, "6300");
  assert.match(await reports.getCmrDifferenceReportCsv(context, { productId: product.id }), /Loaded Quantity,CMR Quantity,Difference/);
});
