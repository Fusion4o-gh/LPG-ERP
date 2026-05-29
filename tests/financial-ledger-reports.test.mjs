import assert from "node:assert/strict";
import test from "node:test";
import { AccountType, NormalBalance, PermissionAction, PrismaClient, VoucherType } from "@prisma/client";

const prisma = new PrismaClient();
const ledgers = await import("../src/server/services/reports/financial-ledgers.ts");
const sessions = await import("../src/server/auth/session.ts");
const customerLedgerRoute = await import("../src/app/api/reports/customer-ledger/route.ts");
const vendorLedgerRoute = await import("../src/app/api/reports/vendor-ledger/route.ts");
const cashBookRoute = await import("../src/app/api/reports/cash-book/route.ts");
const trialBalanceRoute = await import("../src/app/api/reports/trial-balance/route.ts");
const profitLossRoute = await import("../src/app/api/reports/profit-loss/route.ts");
const balanceSheetRoute = await import("../src/app/api/reports/balance-sheet/route.ts");

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function voucherNo(prefix) {
  return doc(prefix);
}

async function fixture() {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({ where: { companyId: company.id, isActive: true } });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  const cash = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, name: "Cash in Hand" } });
  const debtors = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, code: "2004001000" } });
  const creditors = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, code: "1001001000" } });
  const revenue = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, code: "3000000000" } });
  const expenses = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, code: "4000000000" } });
  return { company, financialYear, user, cash, debtors, creditors, revenue, expenses };
}

async function isolatedFinancialYear(companyId) {
  return prisma.financialYear.create({
    data: {
      companyId,
      label: doc("FY"),
      startsOn: new Date("2027-01-01"),
      endsOn: new Date("2027-12-31"),
      isActive: false,
    },
  });
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

async function createAccount(companyId, parentId, prefix, accountType, normalBalance) {
  const account = await prisma.chartAccount.create({
    data: {
      companyId,
      code: doc(prefix),
      name: `${prefix} Account`,
      parentId,
      level: 3,
      accountType,
      normalBalance,
    },
  });
  return account;
}

async function createVoucher(companyId, financialYearId, userId, date, lines, prefix = "FLR") {
  return prisma.accountingVoucher.create({
    data: {
      companyId,
      financialYearId,
      voucherNo: voucherNo(prefix),
      voucherType: VoucherType.JV,
      voucherDate: new Date(date),
      totalDebit: lines.reduce((total, line) => total + line.debit, 0),
      totalCredit: lines.reduce((total, line) => total + line.credit, 0),
      sourceType: "test-report",
      sourceId: doc("SRC"),
      createdById: userId,
      lines: { create: lines },
    },
  });
}

async function csvFrom(route, user, url) {
  const response = await route.GET(await authedGet(user, url));
  const text = await response.text();
  return { response, text };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("customer ledger report calculates opening and running balance from voucher lines", async () => {
  const { company, financialYear, user, cash, debtors } = await fixture();
  const account = await createAccount(company.id, debtors.id, "FLR-CUST-ACC", AccountType.ASSET, NormalBalance.DEBIT);
  const customer = await prisma.customer.create({ data: { companyId: company.id, code: doc("FLR-C"), name: "Ledger Customer", accountId: account.id } });
  await createVoucher(company.id, financialYear.id, user.id, "2026-08-01", [
    { accountId: account.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-08-10", [
    { accountId: account.id, debit: 50, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 50, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-08-11", [
    { accountId: cash.id, debit: 30, credit: 0, sortOrder: 1 },
    { accountId: account.id, debit: 0, credit: 30, sortOrder: 2 },
  ]);

  const report = await ledgers.getCustomerLedgerReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { customerId: customer.id, from: "2026-08-05", to: "2026-08-31" });

  assert.equal(report.openingBalance, 100);
  assert.equal(report.rows.length, 3);
  assert.equal(report.rows[0].runningBalance, 100);
  assert.equal(report.rows[1].runningBalance, 150);
  assert.equal(report.rows[2].runningBalance, 120);
});

test("vendor ledger report calculates credit-normal running balance", async () => {
  const { company, financialYear, user, cash, creditors } = await fixture();
  const account = await createAccount(company.id, creditors.id, "FLR-VEND-ACC", AccountType.LIABILITY, NormalBalance.CREDIT);
  const vendor = await prisma.vendor.create({ data: { companyId: company.id, code: doc("FLR-V"), name: "Ledger Vendor", accountId: account.id } });
  await createVoucher(company.id, financialYear.id, user.id, "2026-09-01", [
    { accountId: cash.id, debit: 200, credit: 0, sortOrder: 1 },
    { accountId: account.id, debit: 0, credit: 200, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-09-10", [
    { accountId: account.id, debit: 60, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 60, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-09-11", [
    { accountId: cash.id, debit: 40, credit: 0, sortOrder: 1 },
    { accountId: account.id, debit: 0, credit: 40, sortOrder: 2 },
  ]);

  const report = await ledgers.getVendorLedgerReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { vendorId: vendor.id, from: "2026-09-05", to: "2026-09-30" });

  assert.equal(report.openingBalance, 200);
  assert.equal(report.rows[1].runningBalance, 140);
  assert.equal(report.rows[2].runningBalance, 180);
});

test("cash book report supports date and account filtering with running balance", async () => {
  const { company, financialYear, user, debtors } = await fixture();
  const cash = await createAccount(company.id, debtors.id, "FLR-Cash-ACC", AccountType.ASSET, NormalBalance.DEBIT);
  const otherAccount = await createAccount(company.id, debtors.id, "FLR-CASH-OFFSET", AccountType.ASSET, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2026-10-01", [
    { accountId: cash.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: otherAccount.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-10-10", [
    { accountId: cash.id, debit: 25, credit: 0, sortOrder: 1 },
    { accountId: otherAccount.id, debit: 0, credit: 25, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-10-11", [
    { accountId: otherAccount.id, debit: 10, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 10, sortOrder: 2 },
  ]);

  const report = await ledgers.getCashBookReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { accountId: cash.id, from: "2026-10-05", to: "2026-10-31" });

  assert.equal(report.openingBalance, 100);
  assert.equal(report.rows.length, 3);
  assert.equal(report.rows[1].runningBalance, 125);
  assert.equal(report.rows[2].runningBalance, 115);
  assert.equal(report.rows.every((row) => row.account.id === cash.id), true);
});

test("financial ledger API rejects invalid filters with structured errors", async () => {
  const { company, user, debtors } = await fixture();
  const account = await createAccount(company.id, debtors.id, "FLR-BAD-DATE", AccountType.ASSET, NormalBalance.DEBIT);
  const customer = await prisma.customer.create({ data: { companyId: company.id, code: doc("FLR-BAD"), name: "Bad Date Customer", accountId: account.id } });

  const response = await customerLedgerRoute.GET(await authedGet(user, `http://localhost/api/reports/customer-ledger?customerId=${customer.id}&from=bad-date`));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.error.message, /from must be a valid date/i);
});

test("financial ledger report denies unauthorized users", async () => {
  const { company, financialYear, debtors } = await fixture();
  const account = await createAccount(company.id, debtors.id, "FLR-NOAUTH-ACC", AccountType.ASSET, NormalBalance.DEBIT);
  const customer = await prisma.customer.create({ data: { companyId: company.id, code: doc("FLR-NOAUTH-C"), name: "No Auth Customer", accountId: account.id } });
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No Report User"), loginId: doc("flr-noauth"), passwordHash: "test" },
  });

  await assert.rejects(
    ledgers.getCustomerLedgerReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { customerId: customer.id }),
    /permission/i,
  );
});

test("trial balance groups debit and credit totals by account with net balances", async () => {
  const { company, financialYear, user, debtors, creditors } = await fixture();
  const asset = await createAccount(company.id, debtors.id, "TB-ASSET", AccountType.ASSET, NormalBalance.DEBIT);
  const liability = await createAccount(company.id, creditors.id, "TB-LIAB", AccountType.LIABILITY, NormalBalance.CREDIT);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-01", [
    { accountId: asset.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-02", [
    { accountId: liability.id, debit: 20, credit: 0, sortOrder: 1 },
    { accountId: asset.id, debit: 0, credit: 20, sortOrder: 2 },
  ]);

  const report = await ledgers.getTrialBalanceReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { from: "2026-11-01", to: "2026-11-30" });
  const assetRow = report.rows.find((row) => row.id === asset.id);
  const liabilityRow = report.rows.find((row) => row.id === liability.id);

  assert.equal(assetRow.totalDebit, 100);
  assert.equal(assetRow.totalCredit, 20);
  assert.equal(assetRow.netDebit, 80);
  assert.equal(assetRow.netCredit, 0);
  assert.equal(liabilityRow.totalDebit, 20);
  assert.equal(liabilityRow.totalCredit, 100);
  assert.equal(liabilityRow.netDebit, 0);
  assert.equal(liabilityRow.netCredit, 80);
});

test("trial balance supports date range and account type filters", async () => {
  const { company, financialYear, user, debtors, creditors } = await fixture();
  const asset = await createAccount(company.id, debtors.id, "TB-FILTER-ASSET", AccountType.ASSET, NormalBalance.DEBIT);
  const liability = await createAccount(company.id, creditors.id, "TB-FILTER-LIAB", AccountType.LIABILITY, NormalBalance.CREDIT);
  await createVoucher(company.id, financialYear.id, user.id, "2026-12-01", [
    { accountId: asset.id, debit: 70, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 70, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-12-15", [
    { accountId: asset.id, debit: 30, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 30, sortOrder: 2 },
  ]);

  const report = await ledgers.getTrialBalanceReport(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { from: "2026-12-10", to: "2026-12-31", accountType: "ASSET" },
  );

  assert.equal(report.rows.some((row) => row.id === liability.id), false);
  const assetRow = report.rows.find((row) => row.id === asset.id);
  assert.equal(assetRow.totalDebit, 30);
  assert.equal(assetRow.totalCredit, 0);
});

test("trial balance API rejects invalid filters with structured errors", async () => {
  const { user } = await fixture();
  const response = await trialBalanceRoute.GET(await authedGet(user, "http://localhost/api/reports/trial-balance?accountType=BAD"));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.error.message, /accountType must be a valid account type/i);
});

test("trial balance denies unauthorized users", async () => {
  const { company, financialYear } = await fixture();
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No TB User"), loginId: doc("tb-noauth"), passwordHash: "test" },
  });

  await assert.rejects(
    ledgers.getTrialBalanceReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, {}),
    /permission/i,
  );
});

test("profit and loss calculates revenue, expenses, and net profit", async () => {
  const { company, user, cash, revenue, expenses } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const salesAccount = await createAccount(company.id, revenue.id, "PL-REV", AccountType.REVENUE, NormalBalance.CREDIT);
  const expenseAccount = await createAccount(company.id, expenses.id, "PL-EXP", AccountType.EXPENSE, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-01-10", [
    { accountId: cash.id, debit: 500, credit: 0, sortOrder: 1 },
    { accountId: salesAccount.id, debit: 0, credit: 500, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-01-11", [
    { accountId: expenseAccount.id, debit: 150, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 150, sortOrder: 2 },
  ]);

  const report = await ledgers.getProfitLossReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { from: "2027-01-01", to: "2027-01-31" });

  assert.equal(report.revenueRows.find((row) => row.id === salesAccount.id).amount, 500);
  assert.equal(report.expenseRows.find((row) => row.id === expenseAccount.id).amount, 150);
  assert.equal(report.totalRevenue, 500);
  assert.equal(report.totalExpenses, 150);
  assert.equal(report.netProfit, 350);
  assert.equal(report.netLoss, 0);
  assert.equal(report.result, "Profit");
});

test("profit and loss supports date filtering", async () => {
  const { company, user, cash, revenue, expenses } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const salesAccount = await createAccount(company.id, revenue.id, "PL-DATE-REV", AccountType.REVENUE, NormalBalance.CREDIT);
  const expenseAccount = await createAccount(company.id, expenses.id, "PL-DATE-EXP", AccountType.EXPENSE, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-02-01", [
    { accountId: cash.id, debit: 900, credit: 0, sortOrder: 1 },
    { accountId: salesAccount.id, debit: 0, credit: 900, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-02-15", [
    { accountId: expenseAccount.id, debit: 200, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 200, sortOrder: 2 },
  ]);

  const report = await ledgers.getProfitLossReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { from: "2027-02-10", to: "2027-02-28" });

  assert.equal(report.revenueRows.some((row) => row.id === salesAccount.id), false);
  assert.equal(report.expenseRows.find((row) => row.id === expenseAccount.id).amount, 200);
  assert.equal(report.totalRevenue, 0);
  assert.equal(report.totalExpenses, 200);
  assert.equal(report.netProfit, -200);
  assert.equal(report.netLoss, 200);
  assert.equal(report.result, "Loss");
});

test("profit and loss API rejects invalid filters with structured errors", async () => {
  const { user } = await fixture();
  const response = await profitLossRoute.GET(await authedGet(user, "http://localhost/api/reports/profit-loss?from=bad-date"));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.error.message, /from must be a valid date/i);
});

test("profit and loss denies unauthorized users", async () => {
  const { company, financialYear } = await fixture();
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No PL User"), loginId: doc("pl-noauth"), passwordHash: "test" },
  });

  await assert.rejects(
    ledgers.getProfitLossReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, {}),
    /permission/i,
  );
});

test("balance sheet calculates asset, liability, equity, and balance check totals", async () => {
  const { company, user, debtors, creditors } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const asset = await createAccount(company.id, debtors.id, "BS-ASSET", AccountType.ASSET, NormalBalance.DEBIT);
  const liability = await createAccount(company.id, creditors.id, "BS-LIAB", AccountType.LIABILITY, NormalBalance.CREDIT);
  const equity = await createAccount(company.id, null, "BS-EQUITY", AccountType.EQUITY, NormalBalance.CREDIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-03-01", [
    { accountId: asset.id, debit: 300, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 100, sortOrder: 2 },
    { accountId: equity.id, debit: 0, credit: 200, sortOrder: 3 },
  ]);

  const report = await ledgers.getBalanceSheetReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { asOf: "2027-03-31" });

  assert.equal(report.assetRows.find((row) => row.id === asset.id).balance, 300);
  assert.equal(report.liabilityRows.find((row) => row.id === liability.id).balance, 100);
  assert.equal(report.equityRows.find((row) => row.id === equity.id).balance, 200);
  assert.equal(report.totalAssets, 300);
  assert.equal(report.totalLiabilities, 100);
  assert.equal(report.totalEquity, 200);
  assert.equal(report.balanceDifference, 0);
  assert.equal(report.isBalanced, true);
});

test("balance sheet supports as-of date filtering", async () => {
  const { company, user, debtors, creditors } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const asset = await createAccount(company.id, debtors.id, "BS-DATE-ASSET", AccountType.ASSET, NormalBalance.DEBIT);
  const liability = await createAccount(company.id, creditors.id, "BS-DATE-LIAB", AccountType.LIABILITY, NormalBalance.CREDIT);
  const equity = await createAccount(company.id, null, "BS-DATE-EQUITY", AccountType.EQUITY, NormalBalance.CREDIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-04-01", [
    { accountId: asset.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-04-20", [
    { accountId: asset.id, debit: 900, credit: 0, sortOrder: 1 },
    { accountId: equity.id, debit: 0, credit: 900, sortOrder: 2 },
  ]);

  const report = await ledgers.getBalanceSheetReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { asOf: "2027-04-10" });

  assert.equal(report.assetRows.find((row) => row.id === asset.id).balance, 100);
  assert.equal(report.liabilityRows.find((row) => row.id === liability.id).balance, 100);
  assert.equal(report.equityRows.some((row) => row.id === equity.id), false);
});

test("balance sheet API rejects invalid filters with structured errors", async () => {
  const { user } = await fixture();
  const response = await balanceSheetRoute.GET(await authedGet(user, "http://localhost/api/reports/balance-sheet?asOf=bad-date"));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.match(body.error.message, /valid date/i);
});

test("balance sheet denies unauthorized users", async () => {
  const { company, financialYear } = await fixture();
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No BS User"), loginId: doc("bs-noauth"), passwordHash: "test" },
  });

  await assert.rejects(
    ledgers.getBalanceSheetReport({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, {}),
    /permission/i,
  );
});

test("customer ledger CSV uses report rows and filters", async () => {
  const { company, financialYear, user, cash, debtors } = await fixture();
  const account = await createAccount(company.id, debtors.id, "CSV-CUST-ACC", AccountType.ASSET, NormalBalance.DEBIT);
  const customer = await prisma.customer.create({ data: { companyId: company.id, code: doc("CSV-C"), name: "CSV Customer", accountId: account.id } });
  await createVoucher(company.id, financialYear.id, user.id, "2027-05-01", [
    { accountId: account.id, debit: 125, credit: 0, sortOrder: 1, description: "before range" },
    { accountId: cash.id, debit: 0, credit: 125, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-05-10", [
    { accountId: account.id, debit: 75, credit: 0, sortOrder: 1, description: "inside range" },
    { accountId: cash.id, debit: 0, credit: 75, sortOrder: 2 },
  ]);

  const { response, text } = await csvFrom(
    customerLedgerRoute,
    user,
    `http://localhost/api/reports/customer-ledger?format=csv&customerId=${customer.id}&from=2027-05-05&to=2027-05-31`,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(text, /Date,Voucher \/ Opening,Source Document,Narration,Debit,Credit,Running Balance/);
  assert.match(text, /,Opening Balance,,,0.00,0.00,125.00/);
  assert.match(text, /inside range,75.00,0.00,200.00/);
  assert.doesNotMatch(text, /before range/);
});

test("vendor ledger CSV outputs credit-normal running balance", async () => {
  const { company, financialYear, user, cash, creditors } = await fixture();
  const account = await createAccount(company.id, creditors.id, "CSV-VEND-ACC", AccountType.LIABILITY, NormalBalance.CREDIT);
  const vendor = await prisma.vendor.create({ data: { companyId: company.id, code: doc("CSV-V"), name: "CSV Vendor", accountId: account.id } });
  await createVoucher(company.id, financialYear.id, user.id, "2027-05-12", [
    { accountId: cash.id, debit: 0, credit: 40, sortOrder: 1 },
    { accountId: account.id, debit: 40, credit: 0, sortOrder: 2, description: "vendor paid" },
  ]);

  const { response, text } = await csvFrom(vendorLedgerRoute, user, `http://localhost/api/reports/vendor-ledger?format=csv&vendorId=${vendor.id}&from=2027-05-01`);

  assert.equal(response.status, 200);
  assert.match(text, /vendor paid,40.00,0.00,-40.00/);
});

test("cash book CSV outputs filtered cash account movement", async () => {
  const { company, financialYear, user, debtors } = await fixture();
  const cash = await createAccount(company.id, debtors.id, "CSV-Cash-ACC", AccountType.ASSET, NormalBalance.DEBIT);
  const offset = await createAccount(company.id, debtors.id, "CSV-CASH-OFFSET", AccountType.ASSET, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-05-15", [
    { accountId: cash.id, debit: 60, credit: 0, sortOrder: 1, description: "cash in" },
    { accountId: offset.id, debit: 0, credit: 60, sortOrder: 2 },
  ]);

  const { response, text } = await csvFrom(cashBookRoute, user, `http://localhost/api/reports/cash-book?format=csv&accountId=${cash.id}&from=2027-05-01`);

  assert.equal(response.status, 200);
  assert.match(text, /cash in,60.00,0.00,60.00/);
});

test("trial balance CSV uses the same date and account-type filters as JSON", async () => {
  const { company, user, debtors, creditors } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const asset = await createAccount(company.id, debtors.id, "CSV-TB-ASSET", AccountType.ASSET, NormalBalance.DEBIT);
  const liability = await createAccount(company.id, creditors.id, "CSV-TB-LIAB", AccountType.LIABILITY, NormalBalance.CREDIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-06-01", [
    { accountId: asset.id, debit: 70, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 70, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-06-20", [
    { accountId: asset.id, debit: 30, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 30, sortOrder: 2 },
  ]);

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const jsonReport = await ledgers.getTrialBalanceReport(context, { from: "2027-06-10", to: "2027-06-30", accountType: "ASSET" });
  const csv = await ledgers.getTrialBalanceReportCsv(context, { from: "2027-06-10", to: "2027-06-30", accountType: "ASSET" });

  assert.equal(jsonReport.rows.length, 1);
  assert.match(csv, /Account Code,Account Name,Type,Total Debit,Total Credit,Net Debit,Net Credit/);
  assert.match(csv, /ASSET,30.00,0.00,30.00,0.00/);
  assert.doesNotMatch(csv, /70.00/);
});

test("profit and loss CSV outputs revenue, expenses, and summary rows", async () => {
  const { company, user, cash, revenue, expenses } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const salesAccount = await createAccount(company.id, revenue.id, "CSV-PL-REV", AccountType.REVENUE, NormalBalance.CREDIT);
  const expenseAccount = await createAccount(company.id, expenses.id, "CSV-PL-EXP", AccountType.EXPENSE, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-07-01", [
    { accountId: cash.id, debit: 400, credit: 0, sortOrder: 1 },
    { accountId: salesAccount.id, debit: 0, credit: 400, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-07-02", [
    { accountId: expenseAccount.id, debit: 90, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 90, sortOrder: 2 },
  ]);

  const csv = await ledgers.getProfitLossReportCsv({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { from: "2027-07-01", to: "2027-07-31" });

  assert.match(csv, /Section,Account Code,Account Name,Amount/);
  assert.match(csv, /Revenue,.*400.00/);
  assert.match(csv, /Total Revenue,400.00/);
  assert.match(csv, /Expenses,.*90.00/);
  assert.match(csv, /Net Profit,310.00/);
});

test("profit and loss monthly breakdown groups amounts by calendar month", async () => {
  const { company, user, cash, revenue, expenses } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const salesAccount = await createAccount(company.id, revenue.id, "PL-MON-REV", AccountType.REVENUE, NormalBalance.CREDIT);
  const expenseAccount = await createAccount(company.id, expenses.id, "PL-MON-EXP", AccountType.EXPENSE, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-08-05", [
    { accountId: cash.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: salesAccount.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-09-10", [
    { accountId: cash.id, debit: 200, credit: 0, sortOrder: 1 },
    { accountId: salesAccount.id, debit: 0, credit: 200, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2027-09-15", [
    { accountId: expenseAccount.id, debit: 50, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 50, sortOrder: 2 },
  ]);

  const report = await ledgers.getProfitLossReport(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { from: "2027-08-01", to: "2027-09-30", breakdown: "month" },
  );

  assert.deepEqual(report.months, ["2027-08", "2027-09"]);
  const sales = report.revenueRows.find((row) => row.id === salesAccount.id);
  assert.equal(sales.monthlyAmounts["2027-08"], 100);
  assert.equal(sales.monthlyAmounts["2027-09"], 200);
  assert.equal(report.monthlyTotals.revenue["2027-09"], 200);
  assert.equal(report.monthlyTotals.expenses["2027-09"], 50);
  assert.equal(report.monthlyTotals.net["2027-09"], 150);
});

test("balance sheet CSV outputs account rows and totals", async () => {
  const { company, user, debtors, creditors } = await fixture();
  const financialYear = await isolatedFinancialYear(company.id);
  const asset = await createAccount(company.id, debtors.id, "CSV-BS-ASSET", AccountType.ASSET, NormalBalance.DEBIT);
  const liability = await createAccount(company.id, creditors.id, "CSV-BS-LIAB", AccountType.LIABILITY, NormalBalance.CREDIT);
  const equity = await createAccount(company.id, null, "CSV-BS-EQUITY", AccountType.EQUITY, NormalBalance.CREDIT);
  await createVoucher(company.id, financialYear.id, user.id, "2027-08-01", [
    { accountId: asset.id, debit: 250, credit: 0, sortOrder: 1 },
    { accountId: liability.id, debit: 0, credit: 100, sortOrder: 2 },
    { accountId: equity.id, debit: 0, credit: 150, sortOrder: 3 },
  ]);

  const csv = await ledgers.getBalanceSheetReportCsv({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { asOf: "2027-08-31" });

  assert.match(csv, /Category,Account Code,Account Name,Debit,Credit,Balance/);
  assert.match(csv, /ASSET,.*250.00,0.00,250.00/);
  assert.match(csv, /Total Assets,,,,,250.00/);
  assert.match(csv, /Total Liabilities,,,,,100.00/);
  assert.match(csv, /Total Equity,,,,,150.00/);
  assert.match(csv, /Balance Difference,,,,,0.00/);
});

test("financial CSV report denies unauthorized users", async () => {
  const { company, financialYear } = await fixture();
  const user = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: doc("No CSV User"), loginId: doc("csv-noauth"), passwordHash: "test" },
  });

  const response = await trialBalanceRoute.GET(await authedGet(user, "http://localhost/api/reports/trial-balance?format=csv"));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.match(body.error.message, /permission/i);
});
