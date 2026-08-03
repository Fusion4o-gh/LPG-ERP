import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const contracts = await import("../src/server/services/import/purchase-contracts.ts");
const purchases = await import("../src/server/services/import/local-purchases.ts");
test.after(async () => prisma.$disconnect());

test("local purchase posts bulk stock, balanced vendor voucher, and contract delivery", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("LP"), name: doc("Local Product") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("LPLOC"), name: doc("Local Purchase Location"), type: "PLANT" } });
  const contract = await contracts.createPurchaseContract(context, { contractDate: "2099-01-03", vendorId: base.seedVendor.id, productId: product.id, quantity: 10, rate: 1000 });
  const purchase = await purchases.createLocalPurchase(context, { contractId: contract.id, vendorId: base.seedVendor.id, productId: product.id, locationId: location.id, quantity: 10, rate: 1000, transactionDate: "2099-01-03" });
  assert.match(purchase.documentNo, /^LP-/); assert.equal(purchase.amount, "10000");
  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: purchase.voucherId }, include: { lines: true } }); assert.equal(voucher.totalDebit.toString(), "10000"); assert.equal(voucher.totalCredit.toString(), "10000");
  assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: purchase.id, direction: "IN" } }), 1); assert.equal((await prisma.purchaseContract.findUniqueOrThrow({ where: { id: contract.id } })).status, "CLOSED");
});

test("local purchase rejects a contract over-delivery", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("LP2"), name: doc("Local Product 2") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("LPLOC2"), name: doc("Local Purchase Location 2"), type: "PLANT" } });
  const contract = await contracts.createPurchaseContract(context, { contractDate: "2099-01-04", vendorId: base.seedVendor.id, productId: product.id, quantity: 5, rate: 1000 });
  await assert.rejects(purchases.createLocalPurchase(context, { contractId: contract.id, vendorId: base.seedVendor.id, productId: product.id, locationId: location.id, quantity: 6, rate: 1000, transactionDate: "2099-01-04" }), /exceeds/i);
});
