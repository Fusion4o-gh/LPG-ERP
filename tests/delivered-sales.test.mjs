import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const opening = await import("../src/server/services/opening-balances/bulk-opening-stock.ts");
const contracts = await import("../src/server/services/import/sale-contracts.ts");
const sales = await import("../src/server/services/import/delivered-sales.ts");
test.after(async () => prisma.$disconnect());

test("delivered sale posts stock OUT, balanced receivable voucher, and contract delivery", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("DSL"), name: doc("Delivery Product") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DSLLOC"), name: doc("Delivery Location"), type: "PLANT" } });
  await opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 50, valuationRate: 500, transactionDate: "2026-08-02" }); const contract = await contracts.createSaleContract(context, { contractDate: "2026-08-02", customerId: base.seedCustomer.id, productId: product.id, quantity: 20, rate: 1500 });
  const sale = await sales.createDeliveredSale(context, { contractId: contract.id, customerId: base.seedCustomer.id, productId: product.id, locationId: location.id, quantity: 20, rate: 1500, transactionDate: "2026-08-02" });
  assert.match(sale.documentNo, /^DSL-/); assert.equal(sale.amount, "30000"); const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: sale.voucherId } }); assert.equal(voucher.totalDebit.toString(), "30000"); assert.equal(voucher.totalCredit.toString(), "30000"); assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: sale.id, direction: "OUT" } }), 1); assert.equal((await prisma.saleContract.findUniqueOrThrow({ where: { id: contract.id } })).saleStatus, "CLOSED");
});

test("delivered sale rejects insufficient bulk stock", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("DSL2"), name: doc("Delivery Product 2") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DSLLOC2"), name: doc("Delivery Location 2"), type: "PLANT" } }); await opening.createBulkOpeningStock(context, { productId: product.id, locationId: location.id, quantity: 2, valuationRate: 500, transactionDate: "2026-08-02" });
  await assert.rejects(sales.createDeliveredSale(context, { customerId: base.seedCustomer.id, productId: product.id, locationId: location.id, quantity: 3, rate: 1500, transactionDate: "2026-08-02" }), /insufficient/i);
});
