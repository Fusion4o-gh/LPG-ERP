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
