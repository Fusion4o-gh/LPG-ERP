import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const service = await import("../src/server/services/accounting/opening-voucher.ts");
test.after(async () => prisma.$disconnect());

test("opening voucher posts a balanced OPV journal and audit record", async () => {
  const base = await baseFixture(prisma);
  const assets = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: base.company.id, accountType: "ASSET", parentId: { not: null }, status: "ACTIVE" } });
  const liability = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: base.company.id, accountType: "LIABILITY", parentId: { not: null }, status: "ACTIVE" } });
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const result = await service.createOpeningVoucher(context, { voucherDate: "2099-01-01", narration: "Initial balances", lines: [{ accountId: assets.id, debit: 1000, credit: 0 }, { accountId: liability.id, debit: 0, credit: 1000 }] });
  assert.match(result.voucherNo, /^OPV-/);
  assert.equal(result.voucher.totalDebit.toString(), "1000");
  assert.equal(result.voucher.totalCredit.toString(), "1000");
  const audit = await prisma.auditLog.findFirst({ where: { companyId: base.company.id, entityType: "OpeningVoucher", entityId: result.voucherNo } });
  assert.ok(audit);
});

test("opening voucher rejects an unbalanced entry", async () => {
  const base = await baseFixture(prisma);
  const account = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: base.company.id, accountType: "ASSET", parentId: { not: null }, status: "ACTIVE" } });
  await assert.rejects(() => service.createOpeningVoucher({ companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }, { voucherDate: "2099-01-02", lines: [{ accountId: account.id, debit: 100, credit: 0 }, { accountId: account.id, debit: 0, credit: 50 }] }), /balanced/);
});
