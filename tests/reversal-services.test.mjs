import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const purchases = await import("../src/server/services/purchases/purchase-filled-cylinder.ts");
const sales = await import("../src/server/services/sales/sale-lpg.ts");
const returns = await import("../src/server/services/returns/cylinder-return.ts");
const payments = await import("../src/server/services/payments/payment-services.ts");
const reversals = await import("../src/server/services/reversals/reversal-policy.ts");

async function fixture() {
  return isolatedFixture(prisma, "REV");
}

async function reverse(context, kind, documentNo) {
  return reversals.createCompensatingReversal(context, {
    kind,
    documentNo,
    reversalDate: "2026-12-15",
    reason: "test reversal",
  });
}

async function assertReversalAudit(kindEntity, documentNo) {
  const audit = await prisma.auditLog.findFirst({ where: { entityType: kindEntity, entityId: documentNo } });
  assert.ok(audit);
}

test.after(async () => {
  await prisma.$disconnect();
});

test("sale LPG reversal creates compensating voucher, stock entry, cylinder balance change, and audit log", async () => {
  const { company, financialYear, user, item, customer, vendor } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  await purchases.purchaseFilledCylinder({ ...context, issueNo: doc("PR-REV-SALE"), vendorId: vendor.id, itemId: item.id, quantity: 2, unitCost: 2000, transactionDate: "2026-12-10" });
  const issueNo = doc("SI-REV");
  await sales.saleLpgSingle({ ...context, issueNo, customerId: customer.id, itemId: item.id, quantity: 2, unitPrice: 3000, transactionDate: "2026-12-10" });
  const before = await prisma.customerCylinderBalance.findUniqueOrThrow({ where: { customerId_itemId: { customerId: customer.id, itemId: item.id } } });

  const result = await reverse(context, "sale", issueNo);

  assert.ok(result.voucher);
  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));
  assert.equal(result.stockEntries[0].direction, "IN");
  const after = await prisma.customerCylinderBalance.findUniqueOrThrow({ where: { customerId_itemId: { customerId: customer.id, itemId: item.id } } });
  assert.equal(after.emptyOwed, before.emptyOwed - 2);
  assert.equal(await prisma.accountingVoucher.count({ where: { voucherNo: issueNo } }), 1);
  await assertReversalAudit("SaleLpgReversal", issueNo);
});

test("purchase filled cylinder reversal creates compensating voucher, stock entry, vendor cylinder change, and audit log", async () => {
  const { company, financialYear, user, item, vendor } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const issueNo = doc("PR-REV");
  await purchases.purchaseFilledCylinder({ ...context, issueNo, vendorId: vendor.id, itemId: item.id, quantity: 1, unitCost: 2000, transactionDate: "2026-12-11" });
  const before = await prisma.vendorCylinderReturnBalance.findUniqueOrThrow({ where: { vendorId_itemId: { vendorId: vendor.id, itemId: item.id } } });

  const result = await reverse(context, "purchase", issueNo);

  assert.ok(result.voucher);
  assert.equal(result.stockEntries[0].direction, "OUT");
  const after = await prisma.vendorCylinderReturnBalance.findUniqueOrThrow({ where: { vendorId_itemId: { vendorId: vendor.id, itemId: item.id } } });
  assert.equal(after.emptyDue, before.emptyDue - 1);
  assert.equal(await prisma.accountingVoucher.count({ where: { voucherNo: issueNo } }), 1);
  await assertReversalAudit("PurchaseFilledCylinderReversal", issueNo);
});

test("cash receipt reversal creates a balanced compensating voucher and audit log", async () => {
  const { company, financialYear, user, customer } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const receiptNo = doc("CRV-REV");
  await payments.cashReceipt({ ...context, receiptNo, customerId: customer.id, amount: 100, transactionDate: "2026-12-12" });

  const result = await reverse(context, "cash-receipt", receiptNo);

  assert.ok(result.voucher);
  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));
  assert.equal(result.stockEntries.length, 0);
  await assertReversalAudit("CashReceiptReversal", receiptNo);
});

test("cash payment reversal creates a balanced compensating voucher and audit log", async () => {
  const { company, financialYear, user, vendor } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const voucherNo = doc("CPV-REV");
  await payments.cashPayment({ ...context, voucherNo, vendorId: vendor.id, amount: 100, transactionDate: "2026-12-12" });

  const result = await reverse(context, "cash-payment", voucherNo);

  assert.ok(result.voucher);
  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));
  await assertReversalAudit("CashPaymentReversal", voucherNo);
});

test("bank receipt reversal creates a balanced compensating voucher and audit log", async () => {
  const { company, financialYear, user, customer, bank } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const receiptNo = doc("BRV-REV");
  await payments.bankReceipt({ ...context, receiptNo, customerId: customer.id, bankId: bank.id, amount: 100, transactionDate: "2026-12-12" });

  const result = await reverse(context, "bank-receipt", receiptNo);

  assert.ok(result.voucher);
  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));
  await assertReversalAudit("BankReceiptReversal", receiptNo);
});

test("bank payment reversal creates a balanced compensating voucher and audit log", async () => {
  const { company, financialYear, user, vendor, bank } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const voucherNo = doc("BPV-REV");
  await payments.bankPayment({ ...context, voucherNo, vendorId: vendor.id, bankId: bank.id, amount: 100, transactionDate: "2026-12-12" });

  const result = await reverse(context, "bank-payment", voucherNo);

  assert.ok(result.voucher);
  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));
  await assertReversalAudit("BankPaymentReversal", voucherNo);
});

test("generic payment reversal kind fails with a clear contract error", async () => {
  const { company, financialYear, user } = await baseFixture(prisma);
  await assert.rejects(
    reversals.createCompensatingReversal(
      { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
      { kind: "payment", documentNo: "PAY-1", reversalDate: "2026-12-12" },
    ),
    /Use cash-receipt, cash-payment, bank-receipt, or bank-payment/i,
  );
});

test("cylinder return reversal creates compensating empty-cylinder stock entry, cylinder balance change, and audit log", async () => {
  const { company, financialYear, user, item, customer, vendor } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  await purchases.purchaseFilledCylinder({ ...context, issueNo: doc("PR-REV-RET"), vendorId: vendor.id, itemId: item.id, quantity: 1, unitCost: 2000, transactionDate: "2026-12-13" });
  await sales.saleLpgSingle({ ...context, issueNo: doc("SI-REV-RET"), customerId: customer.id, itemId: item.id, quantity: 1, unitPrice: 3000, transactionDate: "2026-12-13" });
  const returnNo = doc("RTN-REV");
  await returns.cylinderReturn({ ...context, returnNo, customerId: customer.id, itemId: item.id, quantity: 1, transactionDate: "2026-12-13" });
  const before = await prisma.customerCylinderBalance.findUniqueOrThrow({ where: { customerId_itemId: { customerId: customer.id, itemId: item.id } } });

  const result = await reverse(context, "cylinder-return", returnNo);

  assert.equal(result.voucher, null);
  assert.equal(result.stockEntries[0].direction, "OUT");
  assert.equal(result.stockEntries[0].cylinderState, "EMPTY");
  const after = await prisma.customerCylinderBalance.findUniqueOrThrow({ where: { customerId_itemId: { customerId: customer.id, itemId: item.id } } });
  assert.equal(after.emptyOwed, before.emptyOwed + 1);
  await assertReversalAudit("CylinderReturnReversal", returnNo);
});
