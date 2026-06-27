import assert from "node:assert/strict";
import test from "node:test";
import { AccountType, NormalBalance, PrismaClient, VoucherType } from "@prisma/client";
import { baseFixture, doc, isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const payments = await import("../src/server/services/payments/payment-services.ts");
const sessions = await import("../src/server/auth/session.ts");
const cashReceiptRoute = await import("../src/app/api/payments/cash-receipt/route.ts");
const cashPaymentRoute = await import("../src/app/api/payments/cash-payment/route.ts");
const bankReceiptRoute = await import("../src/app/api/payments/bank-receipt/route.ts");
const bankPaymentRoute = await import("../src/app/api/payments/bank-payment/route.ts");
const documentRoute = await import("../src/app/api/transaction-documents/[documentType]/[documentNo]/route.ts");

async function fixture() {
  const base = await baseFixture(prisma);
  return base;
}

async function createExpenseAccount(companyId, expensesParentId) {
  return prisma.chartAccount.create({
    data: {
      companyId,
      code: doc("MLP-EXP"),
      name: `${doc("MLP-EXP")} Expense`,
      parentId: expensesParentId,
      level: 2,
      accountType: AccountType.EXPENSE,
      normalBalance: NormalBalance.DEBIT,
    },
  });
}

async function findExpensesParent(companyId) {
  return prisma.chartAccount.findFirstOrThrow({ where: { companyId, code: "4000000000" } });
}

async function authedPost(user, url, body) {
  const session = await sessions.createSession(user.id);
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: JSON.stringify(body),
  });
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  await prisma.$disconnect();
});

// ── Service-layer tests ───────────────────────────────────────────────────────

test("multi-line cash receipt creates one balanced voucher", async () => {
  const { company, financialYear, user, seedCustomer } = await fixture();
  const documentNo = doc("ML-CR");

  const result = await payments.multiLineCashReceipt({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    documentNo,
    transactionDate: "2027-11-01",
    narration: "multi-line cash receipt test",
    lines: [
      { accountId: seedCustomer.accountId, amount: 1000, description: "Customer payment line 1" },
      { accountId: seedCustomer.accountId, amount: 500, description: "Customer payment line 2" },
    ],
  });

  assert.ok(result.voucher.id, "voucher must be created");
  assert.equal(result.voucher.voucherType, VoucherType.CR);
  assert.equal(Number(result.voucher.totalDebit), 1500, "total debit must be sum of lines");
  assert.equal(Number(result.voucher.totalCredit), 1500, "total credit must match debit");

  const lines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: result.voucher.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(lines.length, 3, "must have 3 lines: 1 cash debit + 2 counter credits");
  assert.equal(Number(lines[0].debit), 1500, "first line is cash debit for total");
  assert.equal(Number(lines[0].credit), 0);
  assert.equal(Number(lines[1].credit), 1000);
  assert.equal(Number(lines[2].credit), 500);

  const audit = await prisma.auditLog.findFirst({ where: { entityType: "CashReceipt", entityId: documentNo } });
  assert.ok(audit, "audit log must be written");
});

test("multi-line cash payment supports expense account", async () => {
  const { company, financialYear, user } = await fixture();
  const expensesParent = await findExpensesParent(company.id);
  const expenseAccount = await createExpenseAccount(company.id, expensesParent.id);
  const documentNo = doc("ML-CP-EXP");

  const result = await payments.multiLineCashPayment({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    documentNo,
    transactionDate: "2027-11-02",
    lines: [
      { accountId: expenseAccount.id, amount: 2000, description: "Fuel expense" },
      { accountId: expenseAccount.id, amount: 750, description: "Maintenance expense" },
    ],
  });

  assert.ok(result.voucher.id);
  assert.equal(result.voucher.voucherType, VoucherType.CP);
  assert.equal(Number(result.voucher.totalDebit), 2750);
  assert.equal(Number(result.voucher.totalCredit), 2750);

  const lines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: result.voucher.id },
    orderBy: { sortOrder: "asc" },
  });
  // debit lines first, then cash credit last
  assert.equal(Number(lines[0].debit), 2000, "first expense line debited");
  assert.equal(Number(lines[1].debit), 750, "second expense line debited");
  assert.equal(Number(lines[2].credit), 2750, "cash credited for total");
});

test("multi-line bank receipt creates bank debit + multiple credits", async () => {
  const { company, financialYear, user, seedCustomer, bank } = await fixture();
  const documentNo = doc("ML-BR");

  const result = await payments.multiLineBankReceipt({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    documentNo,
    bankId: bank.id,
    transactionDate: "2027-11-03",
    lines: [
      { accountId: seedCustomer.accountId, amount: 3000, description: "Invoice A" },
      { accountId: seedCustomer.accountId, amount: 1500, description: "Invoice B" },
    ],
  });

  assert.ok(result.voucher.id);
  assert.equal(result.voucher.voucherType, VoucherType.BR);
  assert.equal(Number(result.voucher.totalDebit), 4500);
  assert.equal(Number(result.voucher.totalCredit), 4500);

  const lines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: result.voucher.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(lines.length, 3, "must have bank debit + 2 customer credit lines");
  assert.equal(Number(lines[0].debit), 4500, "bank account debited for total");
});

test("multi-line bank payment creates multiple debits + bank credit", async () => {
  const { company, financialYear, user } = await fixture();
  const expensesParent = await findExpensesParent(company.id);
  const expenseAccount = await createExpenseAccount(company.id, expensesParent.id);
  const documentNo = doc("ML-BP");
  const { bank } = await fixture();

  const result = await payments.multiLineBankPayment({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    documentNo,
    bankId: bank.id,
    transactionDate: "2027-11-04",
    lines: [
      { accountId: expenseAccount.id, amount: 1200, description: "Office supplies" },
      { accountId: expenseAccount.id, amount: 800, description: "Utilities" },
    ],
  });

  assert.ok(result.voucher.id);
  assert.equal(result.voucher.voucherType, VoucherType.BP);
  assert.equal(Number(result.voucher.totalDebit), 2000);
  assert.equal(Number(result.voucher.totalCredit), 2000);

  const lines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: result.voucher.id },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(lines.length, 3);
  assert.equal(Number(lines[2].credit), 2000, "bank credited for total as last line");
});

test("unbalanced submission is rejected (empty lines array)", async () => {
  const { company, financialYear, user } = await fixture();
  await assert.rejects(
    payments.multiLineCashReceipt({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      documentNo: doc("ML-BAD"),
      transactionDate: "2027-11-05",
      lines: [],
    }),
    /empty|lines must not be empty/i,
  );
});

test("printable payload includes all voucher lines", async () => {
  const { company, financialYear, user, seedCustomer } = await fixture();
  const documentNo = doc("ML-PRINT");

  await payments.multiLineCashReceipt({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    documentNo,
    transactionDate: "2027-11-06",
    lines: [
      { accountId: seedCustomer.accountId, amount: 400, description: "print line 1" },
      { accountId: seedCustomer.accountId, amount: 600, description: "print line 2" },
    ],
  });

  const req = await authedGet(user, `http://localhost/api/transaction-documents/cash-receipt/${encodeURIComponent(documentNo)}`);
  const res = await documentRoute.GET(req, { params: Promise.resolve({ documentType: "cash-receipt", documentNo }) });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(body.document.voucherLines.length >= 3, "printable payload must include all voucher lines");
  assert.ok(
    body.document.voucherLines.some((l) => l.description === "print line 1"),
    "line 1 description must appear in print payload",
  );
  assert.ok(
    body.document.voucherLines.some((l) => l.description === "print line 2"),
    "line 2 description must appear in print payload",
  );
});

test("existing single-party cash receipt flow still works", async () => {
  const { company, financialYear, user, seedCustomer } = await fixture();
  const receiptNo = doc("SL-CR");

  const result = await payments.cashReceipt({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    receiptNo,
    customerId: seedCustomer.id,
    amount: 1000,
    transactionDate: "2027-11-07",
  });

  assert.ok(result.voucher.id);
  assert.equal(result.voucher.voucherType, VoucherType.CR);
  assert.equal(Number(result.voucher.totalDebit), 1000);

  const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId: result.voucher.id } });
  assert.equal(lines.length, 2, "single-party flow must create exactly 2 lines");
});

test("existing single-party bank payment flow still works", async () => {
  const { company, financialYear, user, seedVendor, bank } = await fixture();
  const voucherNo = doc("SL-BP");

  const result = await payments.bankPayment({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    voucherNo,
    vendorId: seedVendor.id,
    bankId: bank.id,
    amount: 2000,
    transactionDate: "2027-11-08",
  });

  assert.ok(result.voucher.id);
  assert.equal(result.voucher.voucherType, VoucherType.BP);
  assert.equal(Number(result.voucher.totalCredit), 2000);
});

test("unauthorized user denied for multi-line cash receipt", async () => {
  const { company, financialYear, seedCustomer } = await fixture();
  const noAuthUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("MLP-NoAuth"),
      loginId: doc("mlp-noauth"),
      passwordHash: "test",
    },
  });

  await assert.rejects(
    payments.multiLineCashReceipt({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: noAuthUser.id,
      documentNo: doc("ML-UNAUTH"),
      transactionDate: "2027-11-09",
      lines: [{ accountId: seedCustomer.accountId, amount: 500 }],
    }),
    /permission/i,
  );
});

test("closed-day guard is enforced for multi-line cash payment", async () => {
  const { company, financialYear, user } = await fixture();
  const expensesParent = await findExpensesParent(company.id);
  const expenseAccount = await createExpenseAccount(company.id, expensesParent.id);

  const closedDate = new Date("2027-08-15");
  const dayClosing = await prisma.dayClosing.create({
    data: { companyId: company.id, financialYearId: financialYear.id, closedDate, closedById: user.id },
  });
  await prisma.auditLog.create({
    data: { companyId: company.id, userId: user.id, action: "CLOSE_DAY", entityType: "DayClosing", entityId: dayClosing.id, after: { status: "closed" } },
  });

  try {
    await assert.rejects(
      payments.multiLineCashPayment({
        companyId: company.id,
        financialYearId: financialYear.id,
        userId: user.id,
        documentNo: doc("ML-CLOSED"),
        transactionDate: "2027-08-15",
        lines: [{ accountId: expenseAccount.id, amount: 100 }],
      }),
      /closed/i,
    );
  } finally {
    await prisma.auditLog.deleteMany({ where: { entityId: dayClosing.id } });
    await prisma.dayClosing.delete({ where: { id: dayClosing.id } });
  }
});

// ── Account-type guard tests (sales/purchase must not mix with expenses) ───────

async function findAccountByCode(companyId, code) {
  return prisma.chartAccount.findFirstOrThrow({ where: { companyId, code } });
}

test("cash payment rejects a REVENUE (sales) account on a counter line", async () => {
  const { company, financialYear, user } = await fixture();
  const sales = await findAccountByCode(company.id, "3001001001"); // Retail Sales LPG

  await assert.rejects(
    payments.multiLineCashPayment({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      documentNo: doc("ML-CP-REV"),
      transactionDate: "2027-11-12",
      lines: [{ accountId: sales.id, amount: 500, description: "should be blocked" }],
    }),
    /not permitted on this voucher/i,
  );
});

test("cash receipt rejects an EXPENSE account on a counter line", async () => {
  const { company, financialYear, user } = await fixture();
  const expensesParent = await findExpensesParent(company.id);
  const expenseAccount = await createExpenseAccount(company.id, expensesParent.id);

  await assert.rejects(
    payments.multiLineCashReceipt({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      documentNo: doc("ML-CR-EXP"),
      transactionDate: "2027-11-13",
      lines: [{ accountId: expenseAccount.id, amount: 500, description: "should be blocked" }],
    }),
    /not permitted on this voucher/i,
  );
});

test("payment rejects a top-level group (roll-up) account", async () => {
  const { company, financialYear, user } = await fixture();
  const expensesRoot = await findExpensesParent(company.id); // 4000000000, no parent

  await assert.rejects(
    payments.multiLineCashPayment({
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      documentNo: doc("ML-CP-ROOT"),
      transactionDate: "2027-11-14",
      lines: [{ accountId: expensesRoot.id, amount: 500, description: "should be blocked" }],
    }),
    /top-level group/i,
  );
});

test("multi-line cash payment still accepts a customer (Trade Debtors control) account", async () => {
  // Customers/vendors share the Trade Debtors/Creditors control account by design;
  // posting to it must remain allowed (ASSET type, has a parent).
  const { company, financialYear, user, seedCustomer } = await fixture();

  const result = await payments.multiLineCashPayment({
    companyId: company.id,
    financialYearId: financialYear.id,
    userId: user.id,
    documentNo: doc("ML-CP-CTRL"),
    transactionDate: "2027-11-15",
    lines: [{ accountId: seedCustomer.accountId, amount: 500, description: "refund to customer" }],
  });

  assert.ok(result.voucher.id, "posting to the debtors control account must be allowed");
});

// ── API route tests ───────────────────────────────────────────────────────────

test("cash-receipt API route handles multi-line POST", async () => {
  const { company, financialYear, user, seedCustomer } = await fixture();

  const res = await cashReceiptRoute.POST(
    await authedPost(user, "http://localhost/api/payments/cash-receipt", {
      transactionDate: "2027-11-10",
      lines: [{ accountId: seedCustomer.accountId, amount: 800, description: "api test line" }],
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(body.receiptNo || body.voucherNo, "must return a document number");
  assert.ok(body.ids?.voucherId, "must return voucher id");
});

test("bank-payment API route handles multi-line POST", async () => {
  const { company, financialYear, user, bank } = await fixture();
  const expensesParent = await findExpensesParent(company.id);
  const expenseAccount = await createExpenseAccount(company.id, expensesParent.id);

  const res = await bankPaymentRoute.POST(
    await authedPost(user, "http://localhost/api/payments/bank-payment", {
      transactionDate: "2027-11-11",
      bankId: bank.id,
      lines: [
        { accountId: expenseAccount.id, amount: 300, description: "expense via bank api" },
        { accountId: expenseAccount.id, amount: 200, description: "expense 2 via bank api" },
      ],
    }),
  );
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.ok(body.voucherNo);
});
