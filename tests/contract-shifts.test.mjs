import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const shifts = await import("../src/server/services/import/contract-shifts.ts");
test.after(async () => prisma.$disconnect());

test("import loading can shift to a compatible contract with quantity protection", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("CS-P"), name: doc("Shift Product") } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("CS-L"), name: doc("Shift Transit"), type: "IN_TRANSIT" } });
  const source = await prisma.importContract.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, contractNo: doc("SRC"), contractDate: new Date("2026-08-02"), importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 20, rateUsd: 500, exchangeRate: 280, amountUsd: 10000, amountPkr: 280000, createdById: base.user.id } });
  const target = await prisma.importContract.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, contractNo: doc("TGT"), contractDate: new Date("2026-08-02"), importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 20, rateUsd: 500, exchangeRate: 280, amountUsd: 10000, amountPkr: 280000, createdById: base.user.id } });
  const loading = await prisma.loading.create({ data: { companyId: base.company.id, financialYearId: base.financialYear.id, contractId: source.id, loadingType: "TAFTAN", loadingNo: doc("LOAD"), loadingDate: new Date("2026-08-02"), quantityLoaded: 5, rate: 500, freight: 0, finalRate: 500, stockLocationId: location.id, createdById: base.user.id } });
  const result = await shifts.shiftContract(context, { kind: "IMPORT_LOADING", recordId: loading.id, targetContractId: target.id, transactionDate: "2026-08-02" });
  assert.equal(result.record.contractId, target.id); assert.equal(result.quantity, "5"); assert.equal((await prisma.contractShift.count({ where: { recordId: loading.id } })), 1);
});
