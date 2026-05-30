import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AccountType, NormalBalance, PermissionAction, PrismaClient, VoucherType } from "@prisma/client";
import { seedContext } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const ledgers = await import("../src/server/services/reports/financial-ledgers.ts");
const sessions = await import("../src/server/auth/session.ts");
const generalLedgerRoute = await import("../src/app/api/reports/general-ledger/route.ts");

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function fixture() {
  const { company, financialYear, user } = await seedContext(prisma);
  const debtors = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, code: "2004001000" } });
  const cash = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, name: "Cash in Hand" } });
  return { company, financialYear, user, debtors, cash };
}

async function createAccount(companyId, parentId, prefix, accountType, normalBalance) {
  return prisma.chartAccount.create({
    data: { companyId, code: doc(prefix), name: `${prefix} GL Test`, parentId, level: 3, accountType, normalBalance },
  });
}

async function createVoucher(companyId, financialYearId, userId, date, lines) {
  return prisma.accountingVoucher.create({
    data: {
      companyId,
      financialYearId,
      voucherNo: doc("GL-VOU"),
      voucherType: VoucherType.JV,
      voucherDate: new Date(date),
      totalDebit: lines.reduce((s, l) => s + l.debit, 0),
      totalCredit: lines.reduce((s, l) => s + l.credit, 0),
      sourceType: "gl-test",
      sourceId: doc("SRC"),
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

// ── service tests ─────────────────────────────────────────────────────────────

test("general ledger filters by arbitrary account", async () => {
  const { company, financialYear, user, debtors, cash } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-ARBT", AccountType.ASSET, NormalBalance.DEBIT);
  const unrelated = await createAccount(company.id, debtors.id, "GL-OTHER", AccountType.ASSET, NormalBalance.DEBIT);

  await createVoucher(company.id, financialYear.id, user.id, "2026-11-01", [
    { accountId: account.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-02", [
    { accountId: unrelated.id, debit: 500, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 500, sortOrder: 2 },
  ]);

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getGeneralLedgerReport(ctx, { accountId: account.id });

  const dataRows = report.rows.filter((r) => r.voucherNo !== "Opening Balance");
  assert.equal(dataRows.length, 1, "must return only rows for the selected account");
  assert.equal(dataRows[0].debit, 100);
});

test("general ledger opening balance is calculated from voucher lines before from date", async () => {
  const { company, financialYear, user, debtors, cash } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-OPEN", AccountType.ASSET, NormalBalance.DEBIT);

  await createVoucher(company.id, financialYear.id, user.id, "2026-11-01", [
    { accountId: account.id, debit: 200, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 200, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-10", [
    { accountId: account.id, debit: 50, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 50, sortOrder: 2 },
  ]);

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getGeneralLedgerReport(ctx, { accountId: account.id, from: "2026-11-05" });

  assert.equal(report.openingBalance, 200, "opening balance must include lines before from date");
  const openingRow = report.rows[0];
  assert.equal(openingRow.runningBalance, 200, "opening row running balance must equal opening balance");
});

test("general ledger running balance is calculated correctly across lines", async () => {
  const { company, financialYear, user, debtors, cash } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-RUN", AccountType.ASSET, NormalBalance.DEBIT);

  await createVoucher(company.id, financialYear.id, user.id, "2026-11-01", [
    { accountId: account.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-02", [
    { accountId: account.id, debit: 50, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 50, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-03", [
    { accountId: cash.id, debit: 30, credit: 0, sortOrder: 1 },
    { accountId: account.id, debit: 0, credit: 30, sortOrder: 2 },
  ]);

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getGeneralLedgerReport(ctx, { accountId: account.id });

  const rows = report.rows;
  assert.equal(rows[0].runningBalance, 0);   // opening
  assert.equal(rows[1].runningBalance, 100); // +100
  assert.equal(rows[2].runningBalance, 150); // +50
  assert.equal(rows[3].runningBalance, 120); // -30
});

test("general ledger running balance for CREDIT-normal account is inverted", async () => {
  const { company, financialYear, user, debtors, cash } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-CRED", AccountType.LIABILITY, NormalBalance.CREDIT);

  await createVoucher(company.id, financialYear.id, user.id, "2026-11-01", [
    { accountId: cash.id, debit: 300, credit: 0, sortOrder: 1 },
    { accountId: account.id, debit: 0, credit: 300, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-02", [
    { accountId: account.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getGeneralLedgerReport(ctx, { accountId: account.id });

  const rows = report.rows;
  assert.equal(rows[1].runningBalance, 300);  // credit +300 for credit-normal
  assert.equal(rows[2].runningBalance, 200);  // debit -100 for credit-normal
});

test("general ledger date filtering excludes lines outside range", async () => {
  const { company, financialYear, user, debtors, cash } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-DATE", AccountType.ASSET, NormalBalance.DEBIT);

  await createVoucher(company.id, financialYear.id, user.id, "2026-12-01", [
    { accountId: account.id, debit: 100, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 100, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-12-15", [
    { accountId: account.id, debit: 50, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 50, sortOrder: 2 },
  ]);
  await createVoucher(company.id, financialYear.id, user.id, "2026-12-31", [
    { accountId: account.id, debit: 25, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 25, sortOrder: 2 },
  ]);

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  const report = await ledgers.getGeneralLedgerReport(ctx, { accountId: account.id, from: "2026-12-10", to: "2026-12-20" });

  const dataRows = report.rows.filter((r) => r.voucherNo !== "Opening Balance");
  assert.equal(dataRows.length, 1, "must include only lines within date range");
  assert.equal(dataRows[0].debit, 50);
  assert.equal(report.openingBalance, 100, "opening balance from pre-range line");
});

test("general ledger requires accountId", async () => {
  const { company, financialYear, user } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  await assert.rejects(ledgers.getGeneralLedgerReport(ctx, {}), /accountId is required/i);
});

test("general ledger rejects unknown accountId", async () => {
  const { company, financialYear, user } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  await assert.rejects(ledgers.getGeneralLedgerReport(ctx, { accountId: "00000000-0000-0000-0000-000000000000" }), /valid chart account/i);
});

test("unauthorized user is denied access to general ledger", async () => {
  const { company, financialYear, debtors } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-UNAUTH", AccountType.ASSET, NormalBalance.DEBIT);
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "GL No Perm", loginId: doc("gl-noperm"), passwordHash: "test" },
  });
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };
  await assert.rejects(ledgers.getGeneralLedgerReport(ctx, { accountId: account.id }), /permission/i);
});

// ── API route tests ───────────────────────────────────────────────────────────

test("general ledger API returns 400 when accountId is missing", async () => {
  const { user } = await fixture();
  const req = await authedGet(user, "http://localhost/api/reports/general-ledger");
  const res = await generalLedgerRoute.GET(req);
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.match(body.error.message, /accountId is required/i);
});

test("general ledger API returns 400 for invalid date filters", async () => {
  const { user, company, debtors } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-BADDT", AccountType.ASSET, NormalBalance.DEBIT);
  const req = await authedGet(user, `http://localhost/api/reports/general-ledger?accountId=${account.id}&from=not-a-date`);
  const res = await generalLedgerRoute.GET(req);
  assert.equal(res.status, 400);
});

test("general ledger API returns rows for authorized user with valid accountId", async () => {
  const { company, financialYear, user, debtors, cash } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-API", AccountType.ASSET, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-20", [
    { accountId: account.id, debit: 77, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 77, sortOrder: 2 },
  ]);

  const req = await authedGet(user, `http://localhost/api/reports/general-ledger?accountId=${account.id}`);
  const res = await generalLedgerRoute.GET(req);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.rows));
  const dataRow = body.rows.find((r) => r.debit === 77);
  assert.ok(dataRow, "must include the posted voucher line");
});

// ── CSV tests ─────────────────────────────────────────────────────────────────

test("general ledger CSV uses same filters and has correct headers", async () => {
  const { company, financialYear, user, debtors, cash } = await fixture();
  const account = await createAccount(company.id, debtors.id, "GL-CSV", AccountType.ASSET, NormalBalance.DEBIT);
  await createVoucher(company.id, financialYear.id, user.id, "2026-11-25", [
    { accountId: account.id, debit: 88, credit: 0, sortOrder: 1 },
    { accountId: cash.id, debit: 0, credit: 88, sortOrder: 2 },
  ]);

  const req = await authedGet(user, `http://localhost/api/reports/general-ledger?accountId=${account.id}&format=csv`);
  const res = await generalLedgerRoute.GET(req);
  const text = await res.text();

  assert.equal(res.headers.get("Content-Type"), "text/csv; charset=utf-8");
  assert.match(text, /Date.*Voucher.*Debit.*Credit.*Running Balance/i, "CSV must have ledger headers");
  assert.match(text, /88\.00/, "CSV must include posted debit amount");
});

// ── UI source tests ────────────────────────────────────────────────────────────

test("general ledger page uses ReportTableClient with account filter and correct columns", async () => {
  const root = new URL("../", import.meta.url);
  const page = await readFile(new URL("src/app/(protected)/reports/general-ledger/page.tsx", root), "utf8");

  assert.doesNotMatch(page, /ComingSoonPage/, "page must not use ComingSoonPage");
  assert.match(page, /ReportTableClient/, "page must use ReportTableClient");
  assert.match(page, /showAccountFilter/, "page must show account filter");
  assert.match(page, /\/api\/reports\/general-ledger/, "page must point to general-ledger endpoint");
  assert.match(page, /runningBalance/, "page must display running balance column");
  assert.match(page, /voucherNo/, "page must display voucher column");
  assert.match(page, /description|Narration/, "page must display narration column");
});
