import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const reports = await import("../src/server/services/reports/specialized-reports.ts");
const adjustmentRoute = await import("../src/app/api/reports/stock-adjustment/route.ts");
const licenseRoute = await import("../src/app/api/reports/license-detail/route.ts");
test.after(async () => prisma.$disconnect());

test("specialized inventory reports expose adjustment, decant, and partial status data", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("SPR"), name: "Specialized Product" } });
  const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("SPPL"), name: "Specialized Plant" } });
  const source = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("SPSRC"), name: "Specialized Source", type: "PLANT" } });
  const destination = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("SPDST"), name: "Specialized Destination", type: "PLANT" } });
  await prisma.lossGain.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("ADJ"), type: "LOSS", productId: product.id, locationId: source.id, expectedQuantity: 100, actualQuantity: 97, difference: -3, rate: 500, financialImpact: -1500, reason: "Test variance", status: "APPROVED", postedToPl: true, transactionDate: new Date("2026-08-02"), createdById: base.user.id } });
  await prisma.plantDecanting.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("DEC"), plantId: plant.id, sourceLocationId: source.id, destinationLocationId: destination.id, productId: product.id, quantity: 20, unit: "MT", rate: 600, amount: 12000, transactionDate: new Date("2026-08-03"), createdById: base.user.id } });
  await prisma.partialReceiving.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, documentNo: doc("PART"), plantId: plant.id, locationId: destination.id, productId: product.id, dispatchWeight: 50, totalQuantity: 50, receivedQuantity: 30, remainingQuantity: 20, unit: "MT", amount: 30000, loadWeight: 50, finalRate: 600, arrivalStatus: "ARRIVED", transactionDate: new Date("2026-08-04"), createdById: base.user.id } });

  const adjustment = await reports.getStockAdjustmentReport(context, { productId: product.id });
  assert.equal(adjustment.rows[0].difference, "-3");
  assert.equal(adjustment.rows[0].postedToPl, true);
  const decant = await reports.getPlantDecantReport(context, { productId: product.id });
  assert.equal(decant.rows[0].quantity, "20");
  assert.equal(decant.rows[0].destinationLocation.name, "Specialized Destination");
  const partial = await reports.getPartialSaleStatusReport(context, { productId: product.id });
  assert.equal(partial.rows[0].remainingQuantity, "20");
  assert.equal(partial.rows[0].status, "ARRIVED");

  const response = await adjustmentRoute.GET(new Request("http://localhost/api/reports/stock-adjustment?productId=" + product.id + "&format=csv", { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Expected,Actual,Difference/);
});

test("license detail report exposes active driver license records", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const driver = await prisma.driver.create({ data: { companyId: base.company.id, name: doc("Licensed Driver"), licenseNo: "LIC-123", licenseClass: "HTV", licenseIssued: new Date("2024-01-10"), licenseExpiry: new Date("2027-01-10"), status: "ACTIVE" } });
  const report = await reports.getLicenseDetailReport(context, { driverId: driver.id });
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].licenseNo, "LIC-123");
  assert.equal(report.rows[0].licenseClass, "HTV");
  assert.equal(report.rows[0].licenseIssued, "2024-01-10");
  assert.equal(report.rows[0].licenseExpiry, "2027-01-10");
  const response = await licenseRoute.GET(new Request("http://localhost/api/reports/license-detail?driverId=" + driver.id, { headers: { "x-company-id": base.company.id, "x-financial-year-id": base.financialYear.id, "x-user-id": base.user.id } }));
  assert.equal(response.status, 200);
});
