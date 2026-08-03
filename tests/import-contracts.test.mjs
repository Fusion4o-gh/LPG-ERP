import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const contracts = await import("../src/server/services/import/import-contracts.ts");

test.after(async () => prisma.$disconnect());

test("import contract derives totals, generates a number, and does not post stock", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("BULK"), name: doc("LPG Product") } });
  const row = await contracts.createImportContract(context, { contractDate: "2026-08-02", importType: "TAFTAN", vendorId: base.seedVendor.id, productId: product.id, quantity: 100, unit: "MT", rateUsd: 925, exchangeRate: 280 });

  assert.match(row.contractNo, /^IMC-/);
  assert.equal(row.amountUsd, "92500");
  assert.equal(row.amountPkr, "25900000");
  assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { companyId: base.company.id, sourceId: row.id } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { entityType: "ImportContract", entityId: row.id } }), 1);
});

test("import contract rejects invalid references and non-positive quantity", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  await assert.rejects(contracts.createImportContract(context, { contractDate: "2026-08-02", vendorId: "missing", productId: "missing", quantity: 0 }), /invalid|greater/i);
});
