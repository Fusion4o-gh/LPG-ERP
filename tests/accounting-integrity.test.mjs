import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient, AccountType } from "@prisma/client";
import { doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const purchases = await import("../src/server/services/purchases/purchase-filled-cylinder.ts");
const sales = await import("../src/server/services/sales/sale-lpg.ts");
const ledgers = await import("../src/server/services/reports/financial-ledgers.ts");

async function fixture() {
  return isolatedFixture(prisma, "AI");
}

test.after(async () => {
  await prisma.$disconnect();
});

test("purchase discount received is classified as REVENUE in chart of accounts", async () => {
  const { company } = await fixture();
  const account = await prisma.chartAccount.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: "4001001502" } },
  });
  assert.equal(account.accountType, AccountType.REVENUE, "Purchase Discount should be REVENUE, not EXPENSE");
});

test("purchase discount received appears under revenue section of P&L", async () => {
  const { company, financialYear, user, item, vendor } = await fixture();

  const discountAccount = await prisma.chartAccount.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: "4001001502" } },
  });

  // Purchase with discount
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("AI-PUR-DISC"),
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 2,
    unitCost: 1000,
    discount: 100,
    transactionDate: "2026-08-01",
  });

  // Find the most recent voucher with a discount credit line
  const voucher = await prisma.accountingVoucher.findFirstOrThrow({
    where: { companyId: company.id, financialYearId: financialYear.id, sourceId: { contains: "AI-PUR-DISC" } },
    include: { lines: { where: { accountId: discountAccount.id } } },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(voucher.lines.length > 0, "Purchase Discount should have a voucher line");
  const discountLine = voucher.lines[0];
  assert.equal(Number(discountLine.credit), 100, "Discount should be 100 as credit (revenue)");
  assert.equal(Number(discountLine.debit), 0, "Discount should be credit-only");
});

test("sale with COGS produces a balanced voucher that reduces stock asset balance", async () => {
  const { company, financialYear, user, item, customer, vendor } = await fixture();

  const stockAccount = await prisma.chartAccount.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: "2003001001" } },
  });
  const cogsAccount = await prisma.chartAccount.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: "4001002001" } },
  });

  // Purchase 2 units at 1000 each
  const purIssueNo = doc("AI-PUR-COGS");
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: purIssueNo,
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 2,
    unitCost: 1000,
    transactionDate: "2026-08-01",
  });

  // Verify purchase created 2000 stock debit
  const purVoucher = await prisma.accountingVoucher.findFirstOrThrow({
    where: { companyId: company.id, sourceId: purIssueNo },
    include: { lines: { where: { accountId: stockAccount.id } } },
  });
  assert.equal(purVoucher.lines.length, 1, "Purchase should have one stock line");
  assert.equal(Number(purVoucher.lines[0].debit), 2000, "Purchase stock debit should be 2000");

  // Sell 1 unit at 1500
  const issueNo = doc("AI-SALE-COGS");
  const result = await sales.saleLpgSingle({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    customerId: customer.id,
    itemId: item.id,
    quantity: 1,
    unitPrice: 1500,
    transactionDate: "2026-08-02",
  });

  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));

  // Verify COGS lines exist in the voucher
  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({
    where: { id: result.voucher.id },
    include: { lines: true },
  });

  const cogsLine = voucher.lines.find((l) => l.accountId === cogsAccount.id);
  assert.ok(cogsLine, "COGS line should exist on the sale voucher");
  assert.equal(Number(cogsLine.debit), 1000, "COGS should be 1000 (1 unit x 1000 avg cost)");
  assert.equal(Number(cogsLine.credit), 0, "COGS should be debit-only");

  const stockCreditLine = voucher.lines.find((l) => l.accountId === stockAccount.id && Number(l.credit) > 0);
  assert.ok(stockCreditLine, "Stock credit line should exist on the sale voucher");
  assert.equal(Number(stockCreditLine.credit), 1000, "Stock credit should be 1000");
});

test("multi-line sale with COGS produces balanced voucher for each unique item", async () => {
  const { company, financialYear, user, item, seedItem, customer, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("AI-ITEM-2"),
      name: "COGS Test Item 2",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });

  // Purchase items at different costs
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("AI-PUR-MC-1"),
    vendorId: vendor.id,
    transactionDate: "2026-08-01",
    lines: [
      { itemId: item.id, quantity: 3, unitCost: 1000 },
      { itemId: secondItem.id, quantity: 2, unitCost: 2000 },
    ],
  });

  // Sell both items
  const issueNo = doc("AI-SALE-MC");
  const result = await sales.saleLpgSingle({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    customerId: customer.id,
    transactionDate: "2026-08-02",
    lines: [
      { itemId: item.id, quantity: 2, unitPrice: 1500 },
      { itemId: secondItem.id, quantity: 1, unitPrice: 3000 },
    ],
  });

  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({
    where: { id: result.voucher.id },
    include: { lines: true },
  });

  const cogsAccount = await prisma.chartAccount.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: "4001002001" } },
  });
  const stockAccount = await prisma.chartAccount.findUniqueOrThrow({
    where: { companyId_code: { companyId: company.id, code: "2003001001" } },
  });

  const cogsDebitTotal = voucher.lines
    .filter((l) => l.accountId === cogsAccount.id)
    .reduce((sum, l) => sum + Number(l.debit), 0);
  const stockCreditTotal = voucher.lines
    .filter((l) => l.accountId === stockAccount.id)
    .reduce((sum, l) => sum + Number(l.credit), 0);

  assert.equal(cogsDebitTotal, 4000, "Total COGS should be 4000 (2x1000 + 1x2000)");
  assert.equal(stockCreditTotal, 4000, "Total stock credit should match COGS");
  assert.equal(cogsDebitTotal, stockCreditTotal, "COGS debit should equal stock credit");
});
