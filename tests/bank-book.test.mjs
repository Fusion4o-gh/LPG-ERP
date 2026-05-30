import assert from "node:assert/strict";
import test from "node:test";
import { AccountType, NormalBalance, PrismaClient, VoucherType } from "@prisma/client";
import { doc, seedContext } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const ledgers = await import("../src/server/services/reports/financial-ledgers.ts");
const sessions = await import("../src/server/auth/session.ts");
const bankBookRoute = await import("../src/app/api/reports/bank-book/route.ts");

async function fixture() {
  const { company, financialYear, user } = await seedContext(prisma);
  const assets = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, code: "2000000000" } });
  return { company, financialYear, user, assets };
}

async function createBankAccount(companyId, assetsId, prefix) {
  const account = await prisma.chartAccount.create({
    data: {
      companyId,
      code: doc(prefix),
      name: `${prefix} Bank Account`,
      parentId: assetsId,
      level: 2,
      accountType: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
  });
  const bank = await prisma.bank.create({
    data: { companyId, name: doc(prefix), accountId: account.id },
  });
  return { account, bank };
}

async function createOffsetAccount(companyId, assetsId, prefix) {
  return prisma.chartAccount.create({
    data: {
      companyId,
      code: doc(prefix),
      name: `${prefix} Offset`,
      parentId: assetsId,
      level: 2,
      accountType: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
  });
}

async function createVoucher(companyId, financialYearId, userId, date, lines) {
  return prisma.accountingVoucher.create({
    data: {
      companyId,
      financialYearId,
      voucherNo: doc("BB"),
      voucherType: VoucherType.JV,
      voucherDate: new Date(date),
      totalDebit: lines.reduce((t, l) => t + l.debit, 0),
      totalCredit: lines.reduce((t, l) => t + l.credit, 0),
      sourceType: "test-bank-book",
      sourceId: doc("BB-SRC"),
      createdById: userId,
      lines: { create: lines },
    },
  });
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("bank book filters by bank account", async () => {
  const { company, financialYear, user, assets } = await fixture();
  const { account: bankAcct, bank } = await createBankAccount(company.id, assets.id, "BB-FILTER");
  const { account: otherBankAcct, bank: otherBank } = await createBankAccount(company.id, assets.id, "BB-OTHER");
  const offset = await createOffsetAccount(company.id, assets.id, "BB-OFFSET-1");

  await createVoucher(company.id, financialYear.id, user.id, "2027-09-01", [
    { accountId: bankAcct.id, debit: 1000, credit: 0, sortOrder: 1 },
    { accountId: offset.id, debit: 0, credit: 1000, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-09-01", [
    { accountId: otherBankAcct.id, debit: 500, credit: 0, sortOrder: 1 },
    { accountId: offset.id, debit: 0, credit: 500, sortOrder: 2 },
  ]);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getBankBookReport(context, { bankId: bank.id });

  assert.ok(report.rows.every((row) => row.account.id === bankAcct.id), "must only return rows for the selected bank account");
  assert.ok(report.rows.some((row) => row.debit === 1000), "must include bank debit row");
  assert.ok(!report.rows.some((row) => row.debit === 500), "must not include other bank's rows");

  const otherReport = await ledgers.getBankBookReport(context, { bankId: otherBank.id });
  assert.ok(!otherReport.rows.some((row) => row.debit === 1000), "other bank report must not include first bank rows");
});

test("opening balance calculated from prior voucher lines", async () => {
  const { company, financialYear, user, assets } = await fixture();
  const { account: bankAcct, bank } = await createBankAccount(company.id, assets.id, "BB-OPENING");
  const offset = await createOffsetAccount(company.id, assets.id, "BB-OPENING-OFF");

  await createVoucher(company.id, financialYear.id, user.id, "2027-09-05", [
    { accountId: bankAcct.id, debit: 2000, credit: 0, sortOrder: 1 },
    { accountId: offset.id, debit: 0, credit: 2000, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-09-05", [
    { accountId: bankAcct.id, debit: 0, credit: 300, sortOrder: 1 },
    { accountId: offset.id, debit: 300, credit: 0, sortOrder: 2 },
  ]);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getBankBookReport(context, { bankId: bank.id, from: "2027-09-10", to: "2027-09-30" });

  assert.equal(report.openingBalance, 1700, "opening balance must sum prior debits minus credits");
  assert.equal(report.rows[0].runningBalance, 1700, "first row (opening) must carry prior balance");
});

test("running balance calculated correctly", async () => {
  const { company, financialYear, user, assets } = await fixture();
  const { account: bankAcct, bank } = await createBankAccount(company.id, assets.id, "BB-RUNNING");
  const offset = await createOffsetAccount(company.id, assets.id, "BB-RUNNING-OFF");

  await createVoucher(company.id, financialYear.id, user.id, "2027-09-15", [
    { accountId: bankAcct.id, debit: 500, credit: 0, sortOrder: 1 },
    { accountId: offset.id, debit: 0, credit: 500, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-09-16", [
    { accountId: bankAcct.id, debit: 200, credit: 0, sortOrder: 1 },
    { accountId: offset.id, debit: 0, credit: 200, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-09-17", [
    { accountId: bankAcct.id, debit: 0, credit: 100, sortOrder: 1 },
    { accountId: offset.id, debit: 100, credit: 0, sortOrder: 2 },
  ]);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getBankBookReport(context, { bankId: bank.id, from: "2027-09-15", to: "2027-09-30" });

  assert.equal(report.rows[1].runningBalance, 500);
  assert.equal(report.rows[2].runningBalance, 700);
  assert.equal(report.rows[3].runningBalance, 600);
});

test("date filtering works", async () => {
  const { company, financialYear, user, assets } = await fixture();
  const { account: bankAcct, bank } = await createBankAccount(company.id, assets.id, "BB-DATE");
  const offset = await createOffsetAccount(company.id, assets.id, "BB-DATE-OFF");

  await createVoucher(company.id, financialYear.id, user.id, "2027-09-20", [
    { accountId: bankAcct.id, debit: 400, credit: 0, sortOrder: 1, description: "before range" },
    { accountId: offset.id, debit: 0, credit: 400, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-09-25", [
    { accountId: bankAcct.id, debit: 600, credit: 0, sortOrder: 1, description: "inside range" },
    { accountId: offset.id, debit: 0, credit: 600, sortOrder: 2 },
  ]);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getBankBookReport(context, { bankId: bank.id, from: "2027-09-22", to: "2027-09-30" });

  assert.equal(report.openingBalance, 400, "prior transaction contributes to opening balance");
  assert.ok(report.rows.some((row) => row.description === "inside range"), "in-range row must appear");
  assert.ok(!report.rows.some((row) => row.description === "before range"), "out-of-range row must not appear");
});

test("CSV uses same filters as JSON", async () => {
  const { company, financialYear, user, assets } = await fixture();
  const { account: bankAcct, bank } = await createBankAccount(company.id, assets.id, "BB-CSV");
  const offset = await createOffsetAccount(company.id, assets.id, "BB-CSV-OFF");

  await createVoucher(company.id, financialYear.id, user.id, "2027-10-01", [
    { accountId: bankAcct.id, debit: 750, credit: 0, sortOrder: 1, description: "csv bank tx" },
    { accountId: offset.id, debit: 0, credit: 750, sortOrder: 2 },
  ]);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const csv = await ledgers.getBankBookReportCsv(context, { bankId: bank.id, from: "2027-10-01" });

  assert.match(csv, /Date,Voucher \/ Opening,Source Document,Narration,Debit,Credit,Running Balance/);
  assert.match(csv, /csv bank tx,750.00,0.00,750.00/);
});

test("CSV via API returns correct headers", async () => {
  const { company, user, assets } = await fixture();
  const { bank } = await createBankAccount(company.id, assets.id, "BB-CSV-HDR");
  const req = await authedGet(user, `http://localhost/api/reports/bank-book?format=csv&bankId=${bank.id}`);
  const res = await bankBookRoute.GET(req);

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(res.headers.get("content-disposition") ?? "", /bank-book\.csv/);
});

test("invalid bankId rejected", async () => {
  const { company, financialYear, user } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  await assert.rejects(
    ledgers.getBankBookReport(context, { bankId: "nonexistent-id" }),
    /valid bank account/i,
  );
});

test("missing bankId rejected", async () => {
  const { company, financialYear, user } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  await assert.rejects(
    ledgers.getBankBookReport(context, {}),
    /bankId is required/i,
  );
});

test("unauthorized user denied", async () => {
  const { company, financialYear, assets } = await fixture();
  const { bank } = await createBankAccount(company.id, assets.id, "BB-AUTH");
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("BB No Auth"), loginId: doc("bb-noauth"), passwordHash: "test" },
  });

  await assert.rejects(
    ledgers.getBankBookReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { bankId: bank.id }),
    /permission/i,
  );
});

test("Cash Book behavior unchanged", async () => {
  const { company, financialYear, user, assets } = await fixture();
  // Use a fresh account with "Cash" in the name so getCashBookReport accepts it
  const cash = await prisma.chartAccount.create({
    data: {
      companyId: company.id,
      code: doc("BB-Cash-Isolated"),
      name: `${doc("BB-Cash-Isolated")} Cash Isolated`,
      parentId: assets.id,
      level: 2,
      accountType: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
    },
  });
  const offset = await createOffsetAccount(company.id, assets.id, "BB-CASH-OFF");

  await createVoucher(company.id, financialYear.id, user.id, "2027-10-10", [
    { accountId: cash.id, debit: 300, credit: 0, sortOrder: 1, description: "cash book unchanged check" },
    { accountId: offset.id, debit: 0, credit: 300, sortOrder: 2 },
  ]);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getCashBookReport(context, { accountId: cash.id, from: "2027-10-10" });
  assert.ok(report.rows.some((row) => row.description === "cash book unchanged check"), "getCashBookReport must still work after bank book changes");

  const csv = await ledgers.getCashBookReportCsv(context, { accountId: cash.id, from: "2027-10-10" });
  assert.match(csv, /cash book unchanged check/, "getCashBookReportCsv must still work after bank book changes");
});
