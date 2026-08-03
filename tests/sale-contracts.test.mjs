import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const service = await import("../src/server/services/import/sale-contracts.ts");
test.after(async () => prisma.$disconnect());

test("sale contract derives amount and maintains delivered balance", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("SLC"), name: doc("Sale Product") } });
  const row = await service.createSaleContract(context, { contractDate: "2026-08-02", customerId: base.seedCustomer.id, productId: product.id, quantity: 12, rate: 2000 });
  assert.match(row.contractNo, /^SLC-/); assert.equal(row.amount, "24000"); assert.equal(row.deliveredQty, "0"); assert.equal(row.saleStatus, "OPEN");
  const updated = await service.updateSaleContract(context, row.id, { contractNo: row.contractNo, contractDate: "2026-08-02", customerId: base.seedCustomer.id, productId: product.id, quantity: 15, rate: 2100, saleStatus: "PARTIAL" });
  assert.equal(updated.amount, "31500"); assert.equal(updated.saleStatus, "PARTIAL"); assert.equal(await prisma.auditLog.count({ where: { entityType: "SaleContract", entityId: row.id } }), 2);
});
