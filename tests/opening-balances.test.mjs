import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const opening = await import("../src/server/services/opening-balances/opening-balances.ts");

async function grant(userId, companyId, grants) {
  const role = await prisma.role.create({ data: { companyId, name: doc("Opening Role") } });
  for (const [module, actions] of Object.entries(grants)) {
    for (const action of actions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { module_action: { module, action } } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
  }
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

async function fixture(withPermissions = true) {
  const suffix = doc("opening").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `Opening ${suffix}`, stockAvailableCheck: false } });
  const financialYear = await prisma.financialYear.create({
    data: { companyId: company.id, label: suffix, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isActive: true },
  });
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: `Opening User ${suffix}`, loginId: `opening-${suffix}`, passwordHash: "test" },
  });
  if (withPermissions) {
    await grant(user.id, company.id, {
      "stock-ledger": [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.UPDATE, PermissionAction.DELETE],
      "journal-vouchers": [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.UPDATE, PermissionAction.DELETE],
    });
  }
  const category = await prisma.category.create({ data: { companyId: company.id, name: doc("Opening Category") } });
  const item = await prisma.item.create({ data: { companyId: company.id, code: doc("OPEN-ITEM"), name: "Opening Cylinder", categoryId: category.id } });
  const assets = await prisma.chartAccount.create({
    data: { companyId: company.id, code: "2000000000", name: "Assets", level: 1, accountType: "ASSET", normalBalance: "DEBIT", isSystem: true },
  });
  const cashAccount = await prisma.chartAccount.create({
    data: { companyId: company.id, code: "2003010001", name: "Cash in Hand", parentId: assets.id, level: 2, accountType: "ASSET", normalBalance: "DEBIT" },
  });
  const offsetAccount = await prisma.chartAccount.create({
    data: { companyId: company.id, code: "1000000000", name: "Test Liability", level: 1, accountType: "LIABILITY", normalBalance: "CREDIT" },
  });
  return { company, financialYear, user, item, cashAccount, offsetAccount, context: { companyId: company.id, financialYearId: financialYear.id, userId: user.id } };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("shop opening balance creates opening stock ledger and audit log", async () => {
  const { company, context, item } = await fixture();
  const entry = await opening.createShopOpeningBalance(context, {
    itemId: item.id,
    cylinderState: "FILLED",
    quantity: 10,
    transactionDate: "2026-01-01",
  });

  assert.equal(entry.sourceType, "OPENING_BALANCE");
  assert.equal(entry.quantity, 10);
  assert.equal(entry.balanceAfter, 10);
  assert.equal(entry.locked, false);

  const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, entityType: "ShopOpeningBalance", entityId: entry.id } });
  assert.ok(audit);
});

test("cannot modify opening stock after transactions exist", async () => {
  const { context, financialYear, item, user } = await fixture();
  const entry = await opening.createShopOpeningBalance(context, {
    itemId: item.id,
    cylinderState: "EMPTY",
    quantity: 5,
    transactionDate: "2026-01-01",
  });
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: context.companyId,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "EMPTY",
      direction: "IN",
      quantity: 1,
      balanceAfter: 6,
      sourceType: "ADJUSTMENT",
      sourceId: doc("ADJ"),
      transactionDate: new Date("2026-01-02"),
      createdById: user.id,
    },
  });

  await assert.rejects(
    opening.updateShopOpeningBalance(context, entry.id, { itemId: item.id, cylinderState: "EMPTY", quantity: 6, transactionDate: "2026-01-01" }),
    /locked|movement exists/i,
  );
  await assert.rejects(opening.deleteShopOpeningBalance(context, entry.id), /locked/i);
});

test("cash opening creates opening accounting voucher and audit log", async () => {
  const { company, context, cashAccount } = await fixture();
  const result = await opening.createCashOpeningBalance(context, {
    accountId: cashAccount.id,
    amount: 1200,
    transactionDate: "2026-01-01",
    balanceType: "DEBIT",
  });

  assert.match(result.voucherNo, /^CO-/);
  assert.equal(Number(result.amount), 1200);
  assert.equal(result.balanceType, "DEBIT");
  assert.equal(result.locked, false);

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: result.id }, include: { lines: true } });
  assert.equal(voucher.voucherType, "OPENING");
  assert.equal(voucher.sourceType, "CashOpening");
  assert.equal(Number(voucher.totalDebit), Number(voucher.totalCredit));

  const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, entityType: "CashOpening", entityId: result.id } });
  assert.ok(audit);
});

test("cannot modify cash opening after transactions exist", async () => {
  const { context, financialYear, user, cashAccount, offsetAccount } = await fixture();
  const result = await opening.createCashOpeningBalance(context, {
    accountId: cashAccount.id,
    amount: 500,
    transactionDate: "2026-01-01",
  });
  await prisma.accountingVoucher.create({
    data: {
      companyId: context.companyId,
      financialYearId: financialYear.id,
      voucherNo: doc("JV"),
      voucherType: "JV",
      voucherDate: new Date("2026-01-02"),
      sourceType: "TestTransaction",
      sourceId: doc("TX"),
      createdById: user.id,
      totalDebit: 100,
      totalCredit: 100,
      lines: {
        create: [
          { accountId: cashAccount.id, debit: 100, credit: 0, sortOrder: 1 },
          { accountId: offsetAccount.id, debit: 0, credit: 100, sortOrder: 2 },
        ],
      },
    },
  });

  await assert.rejects(
    opening.updateCashOpeningBalance(context, result.id, { accountId: cashAccount.id, amount: 600, transactionDate: "2026-01-01" }),
    /locked/i,
  );
  await assert.rejects(opening.deleteCashOpeningBalance(context, result.id), /locked/i);
});

test("unauthorized user denied for opening balances", async () => {
  const { context, item, cashAccount } = await fixture(false);

  await assert.rejects(opening.createShopOpeningBalance(context, { itemId: item.id, cylinderState: "FILLED", quantity: 1, transactionDate: "2026-01-01" }), /permission/i);
  await assert.rejects(opening.createCashOpeningBalance(context, { accountId: cashAccount.id, amount: 1, transactionDate: "2026-01-01" }), /permission/i);
});

test("invalid quantity and amount are rejected", async () => {
  const { context, item, cashAccount } = await fixture();

  await assert.rejects(opening.createShopOpeningBalance(context, { itemId: item.id, cylinderState: "FILLED", quantity: 0, transactionDate: "2026-01-01" }), /quantity/i);
  await assert.rejects(opening.createCashOpeningBalance(context, { accountId: cashAccount.id, amount: -1, transactionDate: "2026-01-01" }), /amount/i);
});
