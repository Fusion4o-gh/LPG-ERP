import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient, PermissionAction } from "@prisma/client";
import { baseFixture, doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();

const accounting = await import("../src/server/services/accounting/vouchers.ts");
const documentNumbers = await import("../src/server/services/accounting/document-numbers.ts");
const purchases = await import("../src/server/services/purchases/purchase-filled-cylinder.ts");
const sales = await import("../src/server/services/sales/sale-lpg.ts");
const returns = await import("../src/server/services/returns/cylinder-return.ts");
const payments = await import("../src/server/services/payments/payment-services.ts");

async function fixture() {
  return isolatedFixture(prisma, "SL");
}

test.after(async () => {
  await prisma.$disconnect();
});

test("balanced voucher enforcement rejects unbalanced voucher lines", () => {
  assert.throws(
    () =>
      accounting.assertBalancedVoucher([
        { accountId: "cash", debit: 100, credit: 0 },
        { accountId: "sales", debit: 0, credit: 90 },
      ]),
    /balanced/i,
  );
});

test("purchase filled cylinder creates stock ledger, balanced voucher, vendor cylinder balance, and audit log", async () => {
  const { company, financialYear, user, item, vendor } = await fixture();
  const issueNo = doc("PUR");

  const result = await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 3,
    unitCost: 2500,
    gstAmount: 0,
    transactionDate: "2026-07-15",
  });

  assert.equal(result.stockEntries.length, 1);
  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));

  const stockEntry = await prisma.stockLedgerEntry.findFirstOrThrow({ where: { sourceId: issueNo } });
  assert.equal(stockEntry.quantity, 3);
  assert.equal(stockEntry.companyId, company.id);
  assert.equal(stockEntry.financialYearId, financialYear.id);

  const audit = await prisma.auditLog.findFirst({ where: { entityType: "PurchaseFilledCylinder", entityId: issueNo } });
  assert.ok(audit);
});

test("multi-line purchase filled cylinder creates one document with per-line stock, aggregate voucher, GST, empty return, and audit details", async () => {
  const { company, financialYear, user, item, seedItem, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("PUR-MULTI-ITEM"),
      name: "Multi Purchase Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "EMPTY",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: doc("OPEN-EMPTY"),
      transactionDate: new Date("2026-07-14"),
      quantity: 5,
      balanceAfter: 5,
      createdById: user.id,
    },
  });
  const issueNo = doc("PUR-MULTI");

  const result = await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    vendorId: vendor.id,
    remarks: "Legacy GIRN multi-line receipt",
    elevenPointEightKgPrice: 2400,
    transactionDate: "2026-07-15",
    lines: [
      { itemId: item.id, cylinderState: "FILLED", quantity: 3, unitCost: 2500, gstPercent: 10, emptyReturnQuantity: 2 },
      { itemId: secondItem.id, cylinderState: "FILLED", quantity: 2, unitCost: 1500, gstPercent: 5 },
    ],
  });

  assert.equal(result.issueNo, issueNo);
  assert.equal(result.stockEntries.length, 3);
  assert.equal(Number(result.totalExGstAmount), 10500);
  assert.equal(Number(result.totalGstAmount), 900);
  assert.equal(Number(result.totalIncGstAmount), 11400);
  assert.equal(Number(result.voucher.totalDebit), 11400);
  assert.equal(Number(result.voucher.totalCredit), 11400);

  const stockEntries = await prisma.stockLedgerEntry.findMany({
    where: { sourceId: issueNo },
    orderBy: [{ cylinderState: "asc" }, { direction: "asc" }, { quantity: "asc" }],
  });
  assert.equal(stockEntries.length, 3);
  assert.equal(stockEntries.filter((entry) => entry.direction === "IN").length, 2);
  assert.equal(stockEntries.filter((entry) => entry.direction === "OUT").length, 1);
  assert.equal(stockEntries.find((entry) => entry.direction === "OUT")?.quantity, 2);

  const vendorBalance = await prisma.vendorCylinderReturnBalance.findUniqueOrThrow({
    where: { vendorId_itemId: { vendorId: vendor.id, itemId: item.id } },
  });
  assert.equal(vendorBalance.emptyDue, 1);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "PurchaseFilledCylinder", entityId: issueNo } });
  assert.equal(audit.after.lines.length, 2);
  assert.equal(audit.after.lines[0].gstAmount, "750");
  assert.equal(audit.after.lines[0].incGstAmount, "8250");
});

test("single LPG sale creates stock ledger, balanced voucher, customer cylinder accountability, and audit log", async () => {
  const { company, financialYear, user, item, customer, vendor } = await fixture();

  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PUR-SEED"),
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 2,
    unitCost: 2200,
    transactionDate: "2026-07-16",
  });

  const issueNo = doc("SALE");
  const result = await sales.saleLpgSingle({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    customerId: customer.id,
    itemId: item.id,
    quantity: 2,
    unitPrice: 3100,
    transactionDate: "2026-07-16",
  });

  assert.equal(result.stockEntries.length, 1);
  assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));

  const balance = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: customer.id, itemId: item.id } },
  });
  assert.ok(balance.emptyOwed >= 2);

  const audit = await prisma.auditLog.findFirst({ where: { entityType: "SaleLpg", entityId: issueNo } });
  assert.ok(audit);
});

test("multi-line LPG sale creates one document with sale stock outs, same-sale empty returns, aggregate voucher, GST, security, and audit details", async () => {
  const { company, financialYear, user, item, seedItem, customer, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("SALE-MULTI-ITEM"),
      name: "Multi Sale Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });

  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PUR-SALE-MULTI-1"),
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 5,
    unitCost: 2200,
    transactionDate: "2026-07-16",
  });
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PUR-SALE-MULTI-2"),
    vendorId: vendor.id,
    itemId: secondItem.id,
    quantity: 3,
    unitCost: 1800,
    transactionDate: "2026-07-16",
  });

  const issueNo = doc("SALE-MULTI");
  const result = await sales.saleLpgSingle({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo,
    customerId: customer.id,
    saleType: "Direct",
    remarks: "Legacy multi-line sale invoice",
    elevenPointEightKgPrice: 3300,
    invoiceLanguage: "Urdu",
    transactionDate: "2026-07-16",
    lines: [
      { itemId: item.id, quantity: 2, unitPrice: 3000, gstPercent: 10, securityDepositAmount: 500, emptyReturnItemId: item.id, emptyReturnQuantity: 1 },
      { itemId: secondItem.id, quantity: 1, unitPrice: 2000, gstPercent: 5, securityDepositAmount: 250 },
    ],
  });

  assert.equal(result.issueNo, issueNo);
  assert.equal(result.stockEntries.length, 3);
  assert.equal(Number(result.totalExGstAmount), 8000);
  assert.equal(Number(result.totalGstAmount), 700);
  assert.equal(Number(result.totalSecurityAmount), 750);
  assert.equal(Number(result.totalReceivableAmount), 9450);
  assert.equal(Number(result.voucher.totalDebit), 9450);
  assert.equal(Number(result.voucher.totalCredit), 9450);

  const stockEntries = await prisma.stockLedgerEntry.findMany({
    where: { sourceId: issueNo },
    orderBy: [{ direction: "asc" }, { cylinderState: "asc" }, { quantity: "asc" }],
  });
  assert.equal(stockEntries.filter((entry) => entry.direction === "OUT" && entry.cylinderState === "FILLED").length, 2);
  assert.equal(stockEntries.filter((entry) => entry.direction === "IN" && entry.cylinderState === "EMPTY").length, 1);
  assert.equal(stockEntries.find((entry) => entry.direction === "IN" && entry.cylinderState === "EMPTY")?.quantity, 1);

  const firstBalance = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: customer.id, itemId: item.id } },
  });
  assert.equal(firstBalance.emptyOwed, 1);
  assert.equal(Number(firstBalance.securityHeld), 500);

  const secondBalance = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: customer.id, itemId: secondItem.id } },
  });
  assert.equal(secondBalance.emptyOwed, 1);
  assert.equal(Number(secondBalance.securityHeld), 250);

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "SaleLpg", entityId: issueNo } });
  assert.equal(audit.after.invoiceLanguage, "Urdu");
  assert.equal(audit.after.lines.length, 2);
  assert.equal(audit.after.lines[0].gstAmount, "600");
  assert.equal(audit.after.lines[0].incGstAmount, "6600");
});

test("complete day LPG sale batch processes multiple sales in one transaction", async () => {
  const { company, financialYear, user, item, customer, vendor } = await fixture();

  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PUR-BATCH"),
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 2,
    unitCost: 2200,
    transactionDate: "2026-07-17",
  });

  const result = await sales.saleLpgCompleteDayBatch({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    batchNo: doc("DAY-SALE"),
    sales: [
      {
        issueNo: doc("SALE-B1"),
        customerId: customer.id,
        itemId: item.id,
        quantity: 1,
        unitPrice: 3100,
        transactionDate: "2026-07-17",
      },
      {
        issueNo: doc("SALE-B2"),
        customerId: customer.id,
        itemId: item.id,
        quantity: 1,
        unitPrice: 3100,
        transactionDate: "2026-07-17",
      },
    ],
  });

  assert.equal(result.sales.length, 2);
});

test("complete day sale batch supports multi-item rows, cash receipts, credit rows, partial cash, stock, cylinders, and batch audit", async () => {
  const { company, financialYear, user, item, seedItem, customer, seedCustomer, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("DAY-MULTI-ITEM-2"),
      name: "Day Sale Multi Cylinder 2",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  const thirdItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("DAY-MULTI-ITEM-3"),
      name: "Day Sale Multi Cylinder 3",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  const creditCustomer = await prisma.customer.create({
    data: {
      companyId: company.id,
      code: doc("DAY-CREDIT-C"),
      name: "Day Credit Customer",
      accountId: seedCustomer.accountId,
    },
  });

  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PUR-DAY-MULTI"),
    vendorId: vendor.id,
    transactionDate: "2026-07-17",
    lines: [
      { itemId: item.id, quantity: 5, unitCost: 2200 },
      { itemId: secondItem.id, quantity: 4, unitCost: 1800 },
      { itemId: thirdItem.id, quantity: 3, unitCost: 1600 },
    ],
  });

  const batchNo = doc("DAY-BATCH");
  const result = await sales.saleLpgCompleteDayBatch({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    batchNo,
    transactionDate: "2026-07-17",
    remarks: "Legacy complete day sale",
    sales: [
      {
        customerId: customer.id,
        elevenPointEightKgPrice: 3300,
        paymentType: "Cash",
        amountReceived: 4000,
        lines: [
          { itemId: item.id, quantity: 1, unitPrice: 3000 },
          { itemId: secondItem.id, quantity: 2, unitPrice: 2000 },
          { itemId: thirdItem.id, quantity: 1, unitPrice: 1000 },
        ],
      },
      {
        customerId: creditCustomer.id,
        elevenPointEightKgPrice: 3400,
        paymentType: "Credit",
        amountReceived: 0,
        lines: [{ itemId: item.id, quantity: 1, unitPrice: 3200 }],
      },
    ],
  });

  assert.equal(result.sales.length, 2);
  assert.equal(result.issueNos.length, 2);
  assert.notEqual(result.issueNos[0], result.issueNos[1]);
  assert.ok(result.sales[0].receiptVoucher);
  assert.equal(Number(result.sales[0].receiptVoucher.totalDebit), 4000);
  assert.equal(result.sales[1].receiptVoucher, null);
  assert.equal(Number(result.sales[0].voucher.totalDebit), 8000);
  assert.equal(Number(result.sales[1].voucher.totalDebit), 3200);

  const stockEntries = await prisma.stockLedgerEntry.findMany({ where: { sourceId: { in: result.issueNos } } });
  assert.equal(stockEntries.filter((entry) => entry.direction === "OUT" && entry.cylinderState === "FILLED").length, 4);

  const firstBalance = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: customer.id, itemId: secondItem.id } },
  });
  assert.equal(firstBalance.emptyOwed, 2);

  const cashReceiptVouchers = await prisma.accountingVoucher.findMany({ where: { sourceType: "CashReceipt", sourceId: { startsWith: "CRV-" } } });
  assert.equal(cashReceiptVouchers.some((voucher) => Number(voucher.totalDebit) === 4000), true);

  const batchAudit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "CompleteDaySaleBatch", entityId: batchNo } });
  assert.equal(batchAudit.after.count, 2);
  assert.equal(batchAudit.after.rows[0].paymentType, "Cash");
  assert.equal(batchAudit.after.rows[1].paymentType, "Credit");
});

test("cylinder return reduces customer empty cylinder accountability and creates stock/audit entries", async () => {
  const { company, financialYear, user, item, customer, vendor } = await fixture();
  const isolatedCustomer = await prisma.customer.create({
    data: {
      companyId: company.id,
      code: doc("C-RET"),
      name: "Return Test Customer",
      accountId: customer.accountId,
    },
  });

  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PUR-RET"),
    vendorId: vendor.id,
    itemId: item.id,
    quantity: 1,
    unitCost: 2200,
    transactionDate: "2026-07-18",
  });
  await sales.saleLpgSingle({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("SALE-RET"),
    customerId: isolatedCustomer.id,
    itemId: item.id,
    quantity: 1,
    unitPrice: 3100,
    transactionDate: "2026-07-18",
  });

  const before = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: isolatedCustomer.id, itemId: item.id } },
  });
  const returnNo = doc("RET");

  const result = await returns.cylinderReturn({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    returnNo,
    customerId: isolatedCustomer.id,
    itemId: item.id,
    quantity: 1,
    transactionDate: "2026-07-18",
  });

  assert.equal(result.stockEntries.length, 1);
  const after = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: isolatedCustomer.id, itemId: item.id } },
  });
  assert.equal(after.emptyOwed, before.emptyOwed - 1);
});

test("multi-line cylinder return supports empty and filled returns with one return number, stock, voucher, cylinder balance, and audit", async () => {
  const { company, financialYear, user, item, seedItem, customer, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: doc("RET-MULTI-ITEM"),
      name: "Return Multi Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await purchases.purchaseFilledCylinder({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("PUR-RET-MULTI"),
    vendorId: vendor.id,
    transactionDate: "2026-07-18",
    lines: [
      { itemId: item.id, quantity: 3, unitCost: 2200 },
      { itemId: secondItem.id, quantity: 2, unitCost: 1800 },
    ],
  });
  await sales.saleLpgSingle({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    issueNo: doc("SALE-RET-MULTI"),
    customerId: customer.id,
    transactionDate: "2026-07-18",
    lines: [
      { itemId: item.id, quantity: 2, unitPrice: 3000 },
      { itemId: secondItem.id, quantity: 1, unitPrice: 2000 },
    ],
  });

  const returnNo = doc("RET-MULTI");
  const result = await returns.cylinderReturn({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    returnNo,
    customerId: customer.id,
    transactionDate: "2026-07-19",
    remarks: "Legacy sale return",
    lines: [
      { itemId: item.id, returnType: "Empty", quantity: 1 },
      { itemId: secondItem.id, returnType: "Filled", quantity: 1, unitPrice: 2000, gstPercent: 5 },
    ],
  });

  assert.equal(result.returnNo, returnNo);
  assert.equal(result.stockEntries.length, 2);
  assert.equal(Number(result.totalReturnAmount), 2100);
  assert.equal(Number(result.voucher.totalDebit), 2100);
  assert.equal(Number(result.voucher.totalCredit), 2100);

  const stockEntries = await prisma.stockLedgerEntry.findMany({ where: { sourceId: returnNo } });
  assert.equal(stockEntries.filter((entry) => entry.cylinderState === "EMPTY" && entry.direction === "IN").length, 1);
  assert.equal(stockEntries.filter((entry) => entry.cylinderState === "FILLED" && entry.direction === "IN").length, 1);

  const emptyBalance = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: customer.id, itemId: item.id } },
  });
  assert.equal(emptyBalance.emptyOwed, 1);

  const filledBalance = await prisma.customerCylinderBalance.findUniqueOrThrow({
    where: { customerId_itemId: { customerId: customer.id, itemId: secondItem.id } },
  });
  assert.equal(filledBalance.emptyOwed, 1, "filled return does not reduce empty owed; only empty returns do");

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityType: "CylinderReturn", entityId: returnNo } });
  assert.equal(audit.after.lines.length, 2);
  assert.equal(audit.after.lines[0].returnType, "Empty");
  assert.equal(audit.after.lines[1].returnType, "Filled");
  assert.equal(audit.after.lines[1].totalAmount, "2100");
});

test("RBAC denial prevents write services from creating stock or audit entries", async () => {
  const { company, financialYear, item, vendor } = await fixture();
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Denied ${Date.now()}`,
      loginId: doc("denied"),
      passwordHash: "test",
    },
  });
  const issueNo = doc("PUR-DENIED");

  await assert.rejects(
    purchases.purchaseFilledCylinder({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: deniedUser.id,
      issueNo,
      vendorId: vendor.id,
      itemId: item.id,
      quantity: 1,
      unitCost: 2200,
      transactionDate: "2026-07-19",
    }),
    /permission/i,
  );

  const stockCount = await prisma.stockLedgerEntry.count({ where: { sourceId: issueNo } });
  const auditCount = await prisma.auditLog.count({ where: { entityId: issueNo } });
  assert.equal(stockCount, 0);
  assert.equal(auditCount, 0);
});

test("payment services create balanced vouchers for cash, bank, and security variants", async () => {
  const { company, financialYear, user, item, customer, vendor, bank } = await fixture();

  const results = [
    await payments.cashReceipt({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      receiptNo: doc("CRV"),
      customerId: customer.id,
      amount: 500,
      transactionDate: "2026-07-20",
    }),
    await payments.cashPayment({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      voucherNo: doc("CPV"),
      vendorId: vendor.id,
      amount: 400,
      transactionDate: "2026-07-20",
    }),
    await payments.bankReceipt({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      receiptNo: doc("BRV"),
      customerId: customer.id,
      bankId: bank.id,
      amount: 300,
      transactionDate: "2026-07-20",
    }),
    await payments.bankPayment({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      voucherNo: doc("BPV"),
      vendorId: vendor.id,
      bankId: bank.id,
      amount: 200,
      transactionDate: "2026-07-20",
    }),
    await payments.securityReceipt({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      receiptNo: doc("SR"),
      customerId: customer.id,
      itemId: item.id,
      amount: 100,
      transactionDate: "2026-07-20",
    }),
  ];

  for (const result of results) {
    assert.equal(Number(result.voucher.totalDebit), Number(result.voucher.totalCredit));
    const audit = await prisma.auditLog.findFirst({ where: { entityId: result.voucher.voucherNo } });
    assert.ok(audit);
  }
});

test("document-number sequencing is company and financial-year scoped", async () => {
  const { company, financialYear } = await baseFixture(prisma);
  const prefix = doc("SEQ");

  const first = await documentNumbers.nextDocumentNumber({
    companyId: company.id,
    financialYearId: financialYear.id,
    prefix,
  });
  const second = await documentNumbers.nextDocumentNumber({
    companyId: company.id,
    financialYearId: financialYear.id,
    prefix,
  });

  assert.match(first, new RegExp(`^${prefix}-${financialYear.label}-000001$`));
  assert.match(second, new RegExp(`^${prefix}-${financialYear.label}-000002$`));
});

test("closed-day override requires explicit override permission", async () => {
  const { company, financialYear, item, vendor } = await fixture();
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Closed Day Denied ${Date.now()}`,
      loginId: doc("closed-denied"),
      passwordHash: "test",
    },
  });
  const role = await prisma.role.create({
    data: { companyId: company.id, name: doc("purchase-only-role") },
  });
  const permission = await prisma.permission.findUniqueOrThrow({
    where: { module_action: { module: "purchase-filled-cylinders", action: PermissionAction.CREATE } },
  });
  await prisma.userRole.create({ data: { userId: deniedUser.id, roleId: role.id } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  await prisma.dayClosing.upsert({
    where: { companyId_closedDate: { companyId: company.id, closedDate: new Date("2026-07-01") } },
    update: {},
    create: {
      companyId: company.id,
      financialYearId: financialYear.id,
      closedDate: new Date("2026-07-01"),
      closedById: deniedUser.id,
    },
  });

  await assert.rejects(
    purchases.purchaseFilledCylinder({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: deniedUser.id,
      issueNo: doc("PUR-CLOSED"),
      vendorId: vendor.id,
      itemId: item.id,
      quantity: 1,
      unitCost: 2200,
      transactionDate: "2026-06-30",
      allowClosedDayOverride: true,
    }),
    /permission/i,
  );
});
