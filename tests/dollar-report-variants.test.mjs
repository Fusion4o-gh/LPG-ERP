import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const dollars = await import("../src/server/services/dollar/dollar-transactions.ts");
const contracts = await import("../src/server/services/import/sale-contracts.ts");
const reports = await import("../src/server/services/reports/dollar-reports.ts");
const opening = await import("../src/server/services/opening-balances/bulk-opening-stock.ts");
test.after(async () => prisma.$disconnect());

test("dollar report variants isolate contract deliveries and plant bulk sales", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("DRV"), name: doc("Dollar Variant Product") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DRVLOC"), name: doc("Dollar Variant Location"), type: "PLANT" } }); await opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 2, valuationRate: 500, transactionDate: "2099-01-01" }); const contract = await contracts.createSaleContract(context, { contractDate: "2099-01-01", customerId: base.seedCustomer.id, productId: product.id, quantity: 2, rate: 1000 });
  const sale = await dollars.createDollarTransaction(context, { txnType: "SALE_WITH_CONTRACT", customerId: base.seedCustomer.id, contractId: contract.id, productId: product.id, locationId: location.id, quantity: 1, usdAmount: 100, exchangeRate: 280, transactionDate: "2099-01-01" }); const delivered = await reports.getDeliveredSaleDollarReport(context); assert.ok(delivered.rows.some((row) => row.id === sale.id)); assert.match(await reports.getDeliveredSaleDollarReportCsv(context), /Document,Type,Date,USD,Exchange Rate,PKR,Exchange Gain\/Loss,Remarks/);
  const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("DRVP"), name: doc("Dollar Variant Plant") } }); const plantSale = await prisma.plantSale.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("DSPS"), saleType: "BULK", plantId: plant.id, locationId: location.id, customerId: base.seedCustomer.id, productId: product.id, quantity: 1, rate: 300, amount: 300, isDollar: true, transactionDate: new Date("2099-01-01"), createdById: base.user.id } }); const plantReport = await reports.getPlantBulkSaleDollarReport(context); assert.ok(plantReport.rows.some((row) => row.documentNo === plantSale.documentNo)); assert.match(await reports.getPlantBulkSaleDollarReportCsv(context), /Document,Date,Quantity,Rate,Amount,Payment,Remarks/);
});
