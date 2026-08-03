import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const reports = await import("../src/server/services/reports/contract-reports.ts");
const route = await import("../src/app/api/reports/local-purchase-detail/route.ts");
test.after(async () => prisma.$disconnect());

test("local purchase and contract purchase-sale reports reconcile contract quantities and amounts", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("CRP"), name: "Contract Report Product" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("CRLOC"), name: "Contract Report Location", type: "PLANT" } });
  const local = await prisma.localPurchase.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("LPD"), vendorId: base.seedVendor.id, productId: product.id, locationId: location.id, quantity: 12, unit: "MT", rate: 100, amount: 1200, transactionDate: new Date("2026-08-02"), createdById: base.user.id } });
  await prisma.purchaseContract.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, contractNo: doc("PC"), contractDate: new Date("2026-08-01"), vendorId: base.seedVendor.id, productId: product.id, quantity: 20, unit: "MT", rate: 100, amountPkr: 2000, deliveredQty: 12, createdById: base.user.id } });
  await prisma.importContract.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, contractNo: doc("IC"), contractDate: new Date("2026-08-03"), importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 30, unit: "MT", rateUsd: 900, exchangeRate: 280, amountUsd: 27000, amountPkr: 7560000, createdById: base.user.id } });
  const sale = await prisma.saleContract.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, contractNo: doc("SC"), contractDate: new Date("2026-08-04"), customerId: base.seedCustomer.id, productId: product.id, quantity: 10, unit: "MT", rate: 150, amount: 1500, deliveredQty: 4, createdById: base.user.id } });

  const detail = await reports.getLocalPurchaseDetailReport(context, { productId: product.id });
  assert.equal(detail.rows.find((row) => row.id === local.id).amount, "1200");
  const summary = await reports.getLocalPurchaseSummaryReport(context, { productId: product.id });
  assert.equal(summary.rows[0].quantity, "12");
  const contracts = await reports.getContractPurchaseSaleReport(context, { productId: product.id });
  assert.equal(contracts.rows.length, 3);
  assert.equal(contracts.rows.some((row) => row.contractType === "SALE" && row.deliveredQuantity === "4"), true);
  const saleSummary = await reports.getSaleContractSummaryReport(context, { from: "2026-08-01", to: "2026-08-31", customerId: base.seedCustomer.id, productId: product.id });
  assert.equal(saleSummary.rows.length, 1);
  assert.equal(saleSummary.rows[0].remainingQuantity, "6");
  await prisma.saleContract.update({ where: { id: sale.id }, data: { isDollar: true, rateUsd: 10 } });
  const dollarSummary = await reports.getSaleContractDollarSummaryReport(context, { customerId: base.seedCustomer.id, productId: product.id });
  assert.equal(dollarSummary.rows.length, 1);
  assert.equal(dollarSummary.rows[0].rateUsd, "10");
  assert.equal(dollarSummary.rows[0].amountUsd, "100");
  const response = await route.GET(new Request("http://localhost/api/reports/local-purchase-detail?productId=" + product.id + "&format=csv", { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Document No,Date,Contract No/);
});
