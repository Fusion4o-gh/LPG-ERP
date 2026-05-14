import assert from "node:assert/strict";
import test from "node:test";
import { AccountType, NormalBalance, PermissionAction, PrismaClient, VoucherType } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const opening = await import("../src/server/services/opening-balances/opening-balances.ts");

async function grant(userId, companyId, grants) {
  const role = await prisma.role.create({ data: { companyId, name: doc("VOB-Role") } });
  for (const [module, actions] of Object.entries(grants)) {
    for (const action of actions) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { module_action: { module, action } } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
  }
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

async function fixture(withPermissions = true) {
  const suffix = doc("vob").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `VOB ${suffix}`, stockAvailableCheck: false } });
  const financialYear = await prisma.financialYear.create({
    data: { companyId: company.id, label: suffix, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isActive: true },
  });
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: `VOB User ${suffix}`, loginId: `vob-${suffix}`, passwordHash: "test" },
  });
  if (withPermissions) {
    await grant(user.id, company.id, {
      vendors: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.UPDATE, PermissionAction.DELETE],
    });
  }
  const liabilities = await prisma.chartAccount.create({
    data: { companyId: company.id, code: "3000000000", name: "Liabilities", level: 1, accountType: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT, isSystem: true },
  });
  const vendorAccount = await prisma.chartAccount.create({
    data: { companyId: company.id, code: doc("3001001"), name: "Opening Vendor Account", parentId: liabilities.id, level: 2, accountType: AccountType.LIABILITY, normalBalance: NormalBalance.CREDIT },
  });
  const assets = await prisma.chartAccount.create({
    data: { companyId: company.id, code: "2000000000", name: "Assets", level: 1, accountType: AccountType.ASSET, normalBalance: NormalBalance.DEBIT, isSystem: true },
  });
  const offsetAccount = await prisma.chartAccount.create({
    data: { companyId: company.id, code: doc("2001001"), name: "Test Asset Account", parentId: assets.id, level: 2, accountType: AccountType.ASSET, normalBalance: NormalBalance.DEBIT },
  });
  const vendor = await prisma.vendor.create({
    data: { companyId: company.id, code: doc("VOB-V"), name: "Opening Balance Vendor", accountId: vendorAccount.id },
  });
  return { company, financialYear, user, vendor, vendorAccount, offsetAccount, context: { companyId: company.id, financialYearId: financialYear.id, userId: user.id } };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("creates vendor opening credit", async () => {
  const { company, context, vendor, vendorAccount } = await fixture();
  const result = await opening.createVendorOpeningBalance(context, {
    vendorId: vendor.id,
    amount: 850,
    transactionDate: "2026-01-01",
    balanceType: "CREDIT",
  });

  assert.match(result.voucherNo, /^VOB-/);
  assert.equal(Number(result.amount), 850);
  assert.equal(result.balanceType, "CREDIT");
  assert.equal(result.vendorId, vendor.id);
  assert.equal(result.locked, false);

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: result.id }, include: { lines: true } });
  assert.equal(voucher.voucherType, VoucherType.OPENING);
  assert.equal(voucher.sourceType, "VendorOpeningBalance");
  assert.equal(Number(voucher.totalDebit), Number(voucher.totalCredit));
  assert.equal(voucher.lines.some((line) => line.accountId === vendorAccount.id && Number(line.credit) === 850), true);
});

test("creates vendor opening debit", async () => {
  const { context, vendor, vendorAccount } = await fixture();
  const result = await opening.createVendorOpeningBalance(context, {
    vendorId: vendor.id,
    amount: 300,
    transactionDate: "2026-01-01",
    balanceType: "DEBIT",
  });

  assert.equal(Number(result.amount), 300);
  assert.equal(result.balanceType, "DEBIT");

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: result.id }, include: { lines: true } });
  assert.equal(voucher.lines.some((line) => line.accountId === vendorAccount.id && Number(line.debit) === 300), true);
});

test("audit log written on create", async () => {
  const { company, context, vendor } = await fixture();
  const result = await opening.createVendorOpeningBalance(context, {
    vendorId: vendor.id,
    amount: 500,
    transactionDate: "2026-01-01",
    balanceType: "CREDIT",
  });

  const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, entityType: "VendorOpeningBalance", entityId: result.id } });
  assert.ok(audit, "audit log must be written");
});

test("invalid amount rejected", async () => {
  const { context, vendor } = await fixture();
  await assert.rejects(
    opening.createVendorOpeningBalance(context, { vendorId: vendor.id, amount: -100, transactionDate: "2026-01-01" }),
    /positive/i,
  );
  await assert.rejects(
    opening.createVendorOpeningBalance(context, { vendorId: vendor.id, amount: 0, transactionDate: "2026-01-01" }),
    /positive/i,
  );
});

test("duplicate vendor opening balance rejected", async () => {
  const { context, vendor } = await fixture();
  await opening.createVendorOpeningBalance(context, { vendorId: vendor.id, amount: 200, transactionDate: "2026-01-01", balanceType: "CREDIT" });
  await assert.rejects(
    opening.createVendorOpeningBalance(context, { vendorId: vendor.id, amount: 100, transactionDate: "2026-01-01", balanceType: "CREDIT" }),
    /already exists/i,
  );
});

test("unauthorized user denied create", async () => {
  const { context: ctx } = await fixture(false);
  await assert.rejects(
    opening.createVendorOpeningBalance({ ...ctx }, { vendorId: "any", amount: 100, transactionDate: "2026-01-01" }),
    /permission/i,
  );
});

test("unauthorized user denied list", async () => {
  const { context: ctx } = await fixture(false);
  await assert.rejects(opening.listVendorOpeningBalances(ctx), /permission/i);
});

test("cannot modify after vendor transactions exist", async () => {
  const { context, financialYear, user, vendor, vendorAccount, offsetAccount } = await fixture();
  const result = await opening.createVendorOpeningBalance(context, {
    vendorId: vendor.id,
    amount: 600,
    transactionDate: "2026-01-01",
    balanceType: "CREDIT",
  });

  await prisma.accountingVoucher.create({
    data: {
      companyId: context.companyId,
      financialYearId: financialYear.id,
      voucherNo: doc("JV"),
      voucherType: VoucherType.JV,
      voucherDate: new Date("2026-01-05"),
      sourceType: "VendorPayment",
      sourceId: doc("VP"),
      createdById: user.id,
      totalDebit: 200,
      totalCredit: 200,
      lines: {
        create: [
          { accountId: vendorAccount.id, debit: 200, credit: 0, sortOrder: 1 },
          { accountId: offsetAccount.id, debit: 0, credit: 200, sortOrder: 2 },
        ],
      },
    },
  });

  await assert.rejects(
    opening.updateVendorOpeningBalance(context, result.id, { vendorId: vendor.id, amount: 700, transactionDate: "2026-01-01", balanceType: "CREDIT" }),
    /locked/i,
  );
  await assert.rejects(opening.deleteVendorOpeningBalance(context, result.id), /locked/i);
});

test("list returns created opening balances", async () => {
  const { context, vendor } = await fixture();
  const result = await opening.createVendorOpeningBalance(context, {
    vendorId: vendor.id,
    amount: 400,
    transactionDate: "2026-01-01",
    balanceType: "CREDIT",
  });

  const list = await opening.listVendorOpeningBalances(context);
  const found = list.find((v) => v.id === result.id);
  assert.ok(found, "created opening must appear in list");
  assert.equal(found.vendorId, vendor.id);
});
