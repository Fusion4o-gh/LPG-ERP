import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const service = await import("../src/server/services/dollar/dollar-transactions.ts");
test.after(async () => prisma.$disconnect());

test("dollar payment and receipt post exchange gain/loss with balanced vouchers", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const payment = await service.createDollarSettlement(context, { txnType: "PAYMENT", vendorId: base.seedVendor.id, counterAccountId: base.bank.accountId, usdAmount: 100, referenceRate: 280, settlementRate: 290, transactionDate: "2026-08-02" }); assert.match(payment.documentNo, /^DPAY-/); assert.equal(payment.pkrAmount, "29000"); assert.equal(payment.exchangeGainLoss, "-1000");
  const receipt = await service.createDollarSettlement(context, { txnType: "RECEIPT", customerId: base.seedCustomer.id, counterAccountId: base.bank.accountId, usdAmount: 100, referenceRate: 280, settlementRate: 270, transactionDate: "2026-08-02" }); assert.match(receipt.documentNo, /^DREC-/); assert.equal(receipt.exchangeGainLoss, "-1000"); const vouchers = await prisma.accountingVoucher.findMany({ where: { id: { in: [payment.voucherId, receipt.voucherId] } } }); assert.equal(vouchers.every((v) => v.totalDebit.equals(v.totalCredit)), true);
});
