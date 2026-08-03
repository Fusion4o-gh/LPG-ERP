import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const service = await import("../src/server/services/import/purchase-contracts.ts");
test.after(async () => prisma.$disconnect());

test("purchase contract derives amount and supports edits with audit", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("PUC"), name: doc("Purchase Product") } });
  const row = await service.createPurchaseContract(context, { contractDate: "2026-08-02", vendorId: base.seedVendor.id, productId: product.id, quantity: 25, rate: 1000 });
  assert.match(row.contractNo, /^PUC-/); assert.equal(row.amountPkr, "25000"); assert.equal(row.deliveredQty, "0");
  const updated = await service.updatePurchaseContract(context, row.id, { contractNo: row.contractNo, contractDate: "2026-08-02", vendorId: base.seedVendor.id, productId: product.id, quantity: 30, rate: 1100 });
  assert.equal(updated.amountPkr, "33000"); assert.equal(await prisma.auditLog.count({ where: { entityType: "PurchaseContract", entityId: row.id } }), 2);
});
