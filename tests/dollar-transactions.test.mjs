import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const dollars = await import("../src/server/services/dollar/dollar-transactions.ts");
test.after(async () => prisma.$disconnect());

test("dollar purchase and bulk sale derive PKR, post stock, and balance vouchers", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("DOL"), name: doc("Dollar Product") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DOLLOC"), name: doc("Dollar Location"), type: "PLANT" } });
  const purchase = await dollars.createDollarTransaction(context, { txnType: "PURCHASE", vendorId: base.seedVendor.id, productId: product.id, locationId: location.id, quantity: 10, usdAmount: 900, exchangeRate: 280, transactionDate: "2026-08-02" }); assert.match(purchase.documentNo, /^DP-/); assert.equal(purchase.pkrAmount, "252000");
  const sale = await dollars.createDollarTransaction(context, { txnType: "BULK_SALE", customerId: base.seedCustomer.id, productId: product.id, locationId: location.id, quantity: 4, usdAmount: 500, exchangeRate: 280, transactionDate: "2026-08-02" }); assert.match(sale.documentNo, /^DSALE-/); assert.equal(sale.pkrAmount, "140000"); assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: purchase.id, direction: "IN" } }), 1); assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: sale.id, direction: "OUT" } }), 1); const vouchers = await prisma.accountingVoucher.findMany({ where: { id: { in: [purchase.voucherId, sale.voucherId] } } }); assert.equal(vouchers.every((v) => v.totalDebit.equals(v.totalCredit)), true);
});

test("dollar sale with contract requires a matching sale contract", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("DOL2"), name: doc("Dollar Product 2") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DOLLOC2"), name: doc("Dollar Location 2"), type: "PLANT" } });
  await assert.rejects(dollars.createDollarTransaction(context, { txnType: "SALE_WITH_CONTRACT", customerId: base.seedCustomer.id, contractId: "missing", productId: product.id, locationId: location.id, quantity: 1, usdAmount: 100, exchangeRate: 280, transactionDate: "2026-08-02" }), /contractId is invalid/i);
});
