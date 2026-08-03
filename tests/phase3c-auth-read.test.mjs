import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient, VoucherType } from "@prisma/client";
import { baseFixture } from "./helpers/lpg-fixtures.mjs";
import { SEED_ADMIN_PASSWORD } from "./helpers/test-database.mjs";

const prisma = new PrismaClient();
const auth = await import("../src/server/auth/password.ts");
const sessions = await import("../src/server/auth/session.ts");
const stockRoute = await import("../src/app/api/stock-ledger/route.ts");
const balancesRoute = await import("../src/app/api/customer-cylinder-balances/route.ts");
const vouchersRoute = await import("../src/app/api/accounting/vouchers/route.ts");
const voucherDetailRoute = await import("../src/app/api/accounting/vouchers/[id]/route.ts");
const loginRoute = await import("../src/app/api/auth/login/route.ts");
const logoutRoute = await import("../src/app/api/auth/logout/route.ts");
const profileRoute = await import("../src/app/api/auth/profile/route.ts");
const formValidation = await import("../src/lib/form-validation.ts");

async function fixture() {
  const base = await baseFixture(prisma);
  const cash = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: base.company.id, name: "Cash in Hand" } });
  const revenue = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: base.company.id, code: "3000000000" } });
  return {
    company: base.company,
    financialYear: base.financialYear,
    user: base.user,
    item: base.seedItem,
    customer: base.seedCustomer,
    cash,
    revenue,
  };
}

async function authedRequest(url = "http://localhost/api/test") {
  const { user } = await fixture();
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("password helper verifies seeded admin password and rejects bad password", async () => {
  const { user } = await fixture();
  assert.equal(await auth.verifyPassword(SEED_ADMIN_PASSWORD, user.passwordHash), true);
  assert.equal(await auth.verifyPassword("wrong-password", user.passwordHash), false);
});

test("successful login and logout write authentication audit events", async () => {
  const { user, company } = await fixture();
  const before = await prisma.auditLog.count({ where: { companyId: company.id, userId: user.id, entityType: "Authentication" } });
  const loginResponse = await loginRoute.POST(new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ loginId: user.loginId, password: SEED_ADMIN_PASSWORD }),
  }));
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie")?.match(/lpg_erp_session=[^;]+/)?.[0];
  assert.ok(cookie);
  const logoutResponse = await logoutRoute.POST(new Request("http://localhost/api/auth/logout", { method: "POST", headers: { cookie } }));
  assert.equal(logoutResponse.status, 200);
  const events = await prisma.auditLog.findMany({ where: { companyId: company.id, userId: user.id, entityType: "Authentication" }, orderBy: { createdAt: "asc" }, skip: before, select: { action: true } });
  assert.deepEqual(events.map((event) => event.action), ["LOGIN", "LOGOUT"]);
});

test("session helper resolves company, user, and active financial year context", async () => {
  const request = await authedRequest();
  const context = await sessions.getSessionContextFromRequest(request);

  assert.ok(context.userId);
  assert.ok(context.companyId);
  assert.ok(context.financialYearId);
});

test("authenticated profile API reads and updates the current user's contact details", async () => {
  const { user } = await fixture();
  const original = { name: user.name, email: user.email };
  const session = await sessions.createSession(user.id);
  const headers = { cookie: `lpg_erp_session=${session.sessionToken}`, "content-type": "application/json" };

  try {
    const readResponse = await profileRoute.GET(new Request("http://localhost/api/auth/profile", { headers }));
    const readBody = await readResponse.json();
    assert.equal(readResponse.status, 200);
    assert.equal(readBody.profile.loginId, user.loginId);
    assert.equal(readBody.profile.email, original.email);

    const updateResponse = await profileRoute.PUT(new Request("http://localhost/api/auth/profile", {
      method: "PUT",
      headers,
      body: JSON.stringify({ name: "Updated Test Admin", email: "updated-profile@example.com" }),
    }));
    const updateBody = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updateBody.profile.name, "Updated Test Admin");
    assert.equal(updateBody.profile.email, "updated-profile@example.com");

    const audit = await prisma.auditLog.findFirst({ where: { companyId: (await fixture()).company.id, userId: user.id, entityType: "UserProfile", entityId: user.id, action: "UPDATE" }, orderBy: { createdAt: "desc" } });
    assert.ok(audit);
  } finally {
    await prisma.user.update({ where: { id: user.id }, data: original });
    await prisma.session.deleteMany({ where: { userId: user.id } });
  }
});

test("stock ledger read API returns ledger rows for authenticated requests", async () => {
  const request = await authedRequest("http://localhost/api/stock-ledger");
  const response = await stockRoute.GET(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.entries));
});

test("customer cylinder balance read API returns balances for authenticated requests", async () => {
  const request = await authedRequest("http://localhost/api/customer-cylinder-balances");
  const response = await balancesRoute.GET(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.balances));
});

test("voucher list and detail APIs return balanced voucher data", async () => {
  const { company, financialYear, user, cash, revenue } = await fixture();
  const voucher = await prisma.accountingVoucher.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      voucherNo: `READ-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      voucherType: VoucherType.JV,
      // Far-future date so this voucher sorts first in the list endpoint
      // (voucherDate desc, createdAt desc, take 300) even when the shared
      // test database has accumulated thousands of vouchers from other tests.
      voucherDate: new Date("2099-12-31"),
      totalDebit: 10,
      totalCredit: 10,
      sourceType: "test-read",
      sourceId: "test-read-voucher",
      createdById: user.id,
      lines: {
        create: [
          { accountId: cash.id, debit: 10, credit: 0, sortOrder: 1 },
          { accountId: revenue.id, debit: 0, credit: 10, sortOrder: 2 },
        ],
      },
    },
  });
  const listResponse = await vouchersRoute.GET(await authedRequest("http://localhost/api/accounting/vouchers"));
  const listBody = await listResponse.json();

  assert.equal(listResponse.status, 200);
  assert.equal(listBody.success, true);
  assert.ok(Array.isArray(listBody.vouchers));

  assert.ok(listBody.vouchers.some((row) => row.id === voucher.id));

  const filteredResponse = await vouchersRoute.GET(await authedRequest(`http://localhost/api/accounting/vouchers?from=2099-12-31&to=2099-12-31&voucherType=JV&search=${encodeURIComponent(voucher.voucherNo)}`));
  const filteredBody = await filteredResponse.json();
  assert.equal(filteredResponse.status, 200);
  assert.equal(filteredBody.vouchers.length, 1);
  assert.equal(filteredBody.vouchers[0].id, voucher.id);

  const csvResponse = await vouchersRoute.GET(await authedRequest(`http://localhost/api/accounting/vouchers?from=2099-12-31&to=2099-12-31&voucherType=JV&search=${encodeURIComponent(voucher.voucherNo)}&format=csv`));
  const csv = await csvResponse.text();
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(csv, /Voucher No,Type,Date,Total Debit,Total Credit,Status,Source Type,Source Document/);
  assert.match(csv, new RegExp(voucher.voucherNo));

  const detailResponse = await voucherDetailRoute.GET(await authedRequest(`http://localhost/api/accounting/vouchers/${voucher.id}`), { params: Promise.resolve({ id: voucher.id }) });
  const detailBody = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detailBody.success, true);
  assert.ok(Array.isArray(detailBody.voucher.lines));
});

test("form validation helper returns field-level errors", () => {
  const errors = formValidation.validateFormValues(
    { quantity: "0", unitPrice: "", transactionDate: "bad-date" },
    [
      { name: "quantity", label: "Quantity", type: "number", required: true, min: 1 },
      { name: "unitPrice", label: "Unit Price", type: "number", required: true, min: 1 },
      { name: "transactionDate", label: "Date", type: "date", required: true },
    ],
  );

  assert.equal(errors.quantity, "Quantity must be at least 1.");
  assert.equal(errors.unitPrice, "Unit Price is required.");
  assert.equal(errors.transactionDate, "Date must be a valid date.");
});
