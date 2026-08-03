import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const reports = await import("../src/server/services/reports/transport-reports.ts");
const saleRoute = await import("../src/app/api/reports/retail-sale-register/route.ts");
const transitRoute = await import("../src/app/api/reports/stock-transit-reconcile/route.ts");
const vehicleRoute = await import("../src/app/api/reports/vehicle-bowser/route.ts");
const deliveredRoute = await import("../src/app/api/reports/delivered-sale-report/route.ts");
const plantBulkRoute = await import("../src/app/api/reports/plant-bulk-sale-report/route.ts");
const vehicleDetailRoute = await import("../src/app/api/reports/vehicle-report/route.ts");
test.after(async () => prisma.$disconnect());

test("retail register and bowser report aggregate sale documents and transport details", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("TRP"), name: "Transport Product" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("TRLOC"), name: "Transport Location", type: "PLANT" } });
  const transporter = await prisma.transporter.create({ data: { companyId: base.company.id, code: doc("TRT"), name: "Transporter Report" } });
  const vehicle = await prisma.vehicle.create({ data: { companyId: base.company.id, registrationNo: doc("TRV"), transporterId: transporter.id, bowserCapacity: 25, capacityUnit: "MT" } });
  const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("TRPL"), name: "Transport Plant" } });
  await prisma.saleDelivery.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("RTL"), customerId: base.seedCustomer.id, productId: product.id, locationId: location.id, vehicleId: vehicle.id, transporterId: transporter.id, quantity: 10, deliveryWeight: 10, loadWeight: 10.2, rate: 100, finalRate: 120, amount: 1200, transactionDate: new Date("2026-08-02"), createdById: base.user.id } });
  await prisma.plantSale.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("FILL"), saleType: "FILLING", plantId: plant.id, locationId: location.id, customerId: base.seedCustomer.id, productId: product.id, quantity: 5, rate: 120, amount: 600, vehicleId: vehicle.id, transporterId: transporter.id, transactionDate: new Date("2026-08-03"), createdById: base.user.id } });
  await prisma.plantSale.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("BULK"), saleType: "BULK", plantId: plant.id, locationId: location.id, customerId: base.seedCustomer.id, productId: product.id, quantity: 7, rate: 110, amount: 770, vehicleId: vehicle.id, transporterId: transporter.id, transactionDate: new Date("2026-08-04"), createdById: base.user.id } });

  const retail = await reports.getRetailSaleRegisterReport(context, { productId: product.id, vehicleId: vehicle.id });
  assert.equal(retail.rows.length, 2);
  const delivered = await reports.getDeliveredSaleReport(context, { productId: product.id, customerId: base.seedCustomer.id });
  assert.equal(delivered.rows.length, 1);
  assert.equal(delivered.rows[0].amount, "1200");
  const bowser = await reports.getVehicleBowserReport(context, { productId: product.id });
  assert.equal(bowser.rows[0].trips, 2);
  assert.equal(bowser.rows[0].quantity, "15");
  assert.equal(bowser.rows[0].amount, "1800");

  const saleResponse = await saleRoute.GET(new Request("http://localhost/api/reports/retail-sale-register?productId=" + product.id, { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(saleResponse.status, 200);
  const deliveredResponse = await deliveredRoute.GET(new Request("http://localhost/api/reports/delivered-sale-report?productId=" + product.id, { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(deliveredResponse.status, 200);
  const plantBulk = await reports.getPlantBulkSaleReport(context, { productId: product.id, customerId: base.seedCustomer.id });
  assert.equal(plantBulk.rows.length, 1);
  assert.equal(plantBulk.rows[0].amount, "770");
  const plantBulkResponse = await plantBulkRoute.GET(new Request("http://localhost/api/reports/plant-bulk-sale-report?productId=" + product.id, { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(plantBulkResponse.status, 200);
  const vehicleDetail = await reports.getVehicleReport(context, { vehicleId: vehicle.id });
  assert.equal(vehicleDetail.rows.length, 1);
  assert.equal(vehicleDetail.rows[0].trips, 3);
  const vehicleDetailResponse = await vehicleDetailRoute.GET(new Request("http://localhost/api/reports/vehicle-report?vehicleId=" + vehicle.id, { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(vehicleDetailResponse.status, 200);
  const vehicleCsv = await vehicleRoute.GET(new Request("http://localhost/api/reports/vehicle-bowser?format=csv", { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.match(await vehicleCsv.text(), /Vehicle,Transporter,Capacity/);
});

test("stock transit reconcile compares ledger balance with outstanding loading documents", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("STR"), name: "Transit Product" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("STRLOC"), name: "Transit Location", type: "IMPORT_TERMINAL" } });
  const contracts = await import("../src/server/services/import/import-contracts.ts");
  const loadings = await import("../src/server/services/import/loadings.ts");
  const contract = await contracts.createImportContract(context, { contractDate: "2097-01-01", importType: "SHIP", vendorId: base.seedVendor.id, productId: product.id, quantity: 50, rateUsd: 800, exchangeRate: 280 });
  const loading = await loadings.createLoading(context, { contractId: contract.id, loadingDate: "2097-01-02", stockLocationId: location.id, quantityLoaded: 40 });
  await loadings.receiveLoading(context, loading.id, { arrivalDate: "2097-01-03", arrivalLocationId: location.id, arrivedQuantity: 10 });
  const report = await reports.getStockTransitReconcileReport(context, { productId: product.id });
  const row = report.rows.find((entry) => entry.product?.id === product.id);
  assert.equal(row.ledgerTransit, "30");
  assert.equal(row.documentTransit, "30");
  assert.equal(row.difference, "0");
  const response = await transitRoute.GET(new Request("http://localhost/api/reports/stock-transit-reconcile?productId=" + product.id, { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(response.status, 200);
});
