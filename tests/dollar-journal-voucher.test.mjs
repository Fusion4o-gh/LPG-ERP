import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { seedContext } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const service = await import("../src/server/services/accounting/journal-voucher.ts");
const created = [];

test.after(async () => {
  for (const voucherNo of created) {
    await prisma.auditLog.deleteMany({ where: { entityType: "DollarJournalVoucher", entityId: voucherNo } });
    await prisma.accountingVoucherLine.deleteMany({ where: { voucher: { voucherNo } } });
    await prisma.accountingVoucher.deleteMany({ where: { voucherNo } });
  }
  await prisma.$disconnect();
});

test("Dollar JV stores balanced PKR and FC line values", async () => {
  const { company, financialYear, user } = await seedContext(prisma);
  const accounts = await prisma.chartAccount.findMany({ where: { companyId: company.id, level: 3 }, take: 2 });
  assert.equal(accounts.length, 2);
  const result = await service.createDollarJournalVoucher({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    voucherDate: "2027-02-01",
    narration: "Dollar JV test",
    lines: [
      { accountId: accounts[0].id, debit: 28000, credit: 0, foreignDebit: 100, foreignCredit: 0 },
      { accountId: accounts[1].id, debit: 0, credit: 28000, foreignDebit: 0, foreignCredit: 100 },
    ],
  });
  created.push(result.voucherNo);
  assert.match(result.voucherNo, /^DJV-/);
  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: result.voucher.id }, include: { lines: true } });
  assert.equal(voucher.sourceType, "DollarJournalVoucher");
  assert.deepEqual(voucher.lines.map((line) => [line.foreignDebit.toString(), line.foreignCredit.toString()]), [["100", "0"], ["0", "100"]]);
});

test("Dollar JV rejects an FC imbalance", async () => {
  const { company, financialYear, user } = await seedContext(prisma);
  const accounts = await prisma.chartAccount.findMany({ where: { companyId: company.id, level: 3 }, take: 2 });
  await assert.rejects(
    service.createDollarJournalVoucher({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      voucherDate: "2027-02-02",
      lines: [
        { accountId: accounts[0].id, debit: 28000, credit: 0, foreignDebit: 100, foreignCredit: 0 },
        { accountId: accounts[1].id, debit: 0, credit: 28000, foreignDebit: 0, foreignCredit: 90 },
      ],
    }),
    /FC debit and credit totals/,
  );
});
