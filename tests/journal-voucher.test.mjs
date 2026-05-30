import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { seedContext } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const jv = await import("../src/server/services/accounting/journal-voucher.ts");
const sessions = await import("../src/server/auth/session.ts");
const jvRoute = await import("../src/app/api/accounting/journal-vouchers/route.ts");

const cleanup = {
  voucherNos: new Set(),
  userIds: new Set(),
  roleIds: new Set(),
};

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function fixture() {
  const { company, financialYear, user } = await seedContext(prisma);
  const debitAcct = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, level: 3 } });
  const creditAcct = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, level: 3, id: { not: debitAcct.id } } });
  return { company, financialYear, user, debitAcct, creditAcct };
}

async function withJvPermission(companyId, action, user) {
  const perm = await prisma.permission.upsert({
    where: { module_action: { module: "journal-vouchers", action } },
    update: {},
    create: { module: "journal-vouchers", action },
  });
  const role = await prisma.role.create({ data: { companyId, name: doc("JV-ROLE") } });
  cleanup.roleIds.add(role.id);
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return role;
}

async function authedPost(user, url, body) {
  const session = await sessions.createSession(user.id);
  return new Request(url, {
    method: "POST",
    headers: { cookie: `lpg_erp_session=${session.sessionToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  if (cleanup.voucherNos.size) {
    await prisma.auditLog.deleteMany({ where: { entityType: "JournalVoucher", entityId: { in: [...cleanup.voucherNos] } } });
    await prisma.accountingVoucherLine.deleteMany({ where: { voucher: { voucherNo: { in: [...cleanup.voucherNos] } } } });
    await prisma.accountingVoucher.deleteMany({ where: { voucherNo: { in: [...cleanup.voucherNos] } } });
  }
  if (cleanup.roleIds.size) {
    await prisma.rolePermission.deleteMany({ where: { roleId: { in: [...cleanup.roleIds] } } });
    await prisma.userRole.deleteMany({ where: { roleId: { in: [...cleanup.roleIds] } } });
    await prisma.role.deleteMany({ where: { id: { in: [...cleanup.roleIds] } } });
  }
  if (cleanup.userIds.size) {
    await prisma.session.deleteMany({ where: { userId: { in: [...cleanup.userIds] } } });
    await prisma.user.deleteMany({ where: { id: { in: [...cleanup.userIds] } } });
  }
  await prisma.$disconnect();
});

// ── service tests ─────────────────────────────────────────────────────────────

test("create balanced JV posts voucher with correct totals", async () => {
  const { company, financialYear, user, debitAcct, creditAcct } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  const result = await jv.createJournalVoucher({
    ...ctx,
    voucherDate: "2027-01-10",
    narration: "JV test",
    lines: [
      { accountId: debitAcct.id, debit: 500, credit: 0 },
      { accountId: creditAcct.id, debit: 0, credit: 500 },
    ],
  });

  cleanup.voucherNos.add(result.voucherNo);
  assert.ok(result.voucherNo.startsWith("JV-"), `voucherNo should start with JV-, got ${result.voucherNo}`);
  assert.equal(Number(result.voucher.totalDebit), 500);
  assert.equal(Number(result.voucher.totalCredit), 500);
  assert.equal(result.voucher.voucherType, "JV");
  assert.equal(result.voucher.sourceType, "JournalVoucher");
});

test("create JV writes audit log", async () => {
  const { company, financialYear, user, debitAcct, creditAcct } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  const result = await jv.createJournalVoucher({
    ...ctx,
    voucherDate: "2027-01-11",
    lines: [
      { accountId: debitAcct.id, debit: 200, credit: 0 },
      { accountId: creditAcct.id, debit: 0, credit: 200 },
    ],
  });

  cleanup.voucherNos.add(result.voucherNo);
  const audit = await prisma.auditLog.findFirst({ where: { entityType: "JournalVoucher", entityId: result.voucherNo } });
  assert.ok(audit, "audit log must be written");
  assert.equal(audit.entityId, result.voucherNo);
});

test("reject unbalanced JV", async () => {
  const { company, financialYear, user, debitAcct, creditAcct } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  await assert.rejects(
    jv.createJournalVoucher({
      ...ctx,
      voucherDate: "2027-01-12",
      lines: [
        { accountId: debitAcct.id, debit: 300, credit: 0 },
        { accountId: creditAcct.id, debit: 0, credit: 200 },
      ],
    }),
    /balanced/i,
  );
});

test("reject JV with empty lines", async () => {
  const { company, financialYear, user } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  await assert.rejects(
    jv.createJournalVoucher({ ...ctx, voucherDate: "2027-01-13", lines: [] }),
    /at least one line/i,
  );
});

test("unauthorized user is denied JV creation", async () => {
  const { company, financialYear, debitAcct, creditAcct } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "JV No Perm", loginId: doc("jv-noperm"), passwordHash: "test" },
  });
  cleanup.userIds.add(noPermUser.id);

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };
  await assert.rejects(
    jv.createJournalVoucher({
      ...ctx,
      voucherDate: "2027-01-14",
      lines: [
        { accountId: debitAcct.id, debit: 100, credit: 0 },
        { accountId: creditAcct.id, debit: 0, credit: 100 },
      ],
    }),
    /permission/i,
  );
});

test("unauthorized user is denied JV listing", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "JV List No Perm", loginId: doc("jv-list-noperm"), passwordHash: "test" },
  });
  cleanup.userIds.add(noPermUser.id);

  await assert.rejects(
    jv.listJournalVouchers({ companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id }),
    /permission/i,
  );
});

test("list JV vouchers returns posted manual JVs only", async () => {
  const { company, financialYear, user, debitAcct, creditAcct } = await fixture();
  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };

  const result = await jv.createJournalVoucher({
    ...ctx,
    voucherDate: "2027-01-15",
    narration: "list test",
    lines: [
      { accountId: debitAcct.id, debit: 100, credit: 0 },
      { accountId: creditAcct.id, debit: 0, credit: 100 },
    ],
  });
  cleanup.voucherNos.add(result.voucherNo);

  const list = await jv.listJournalVouchers(ctx);
  const found = list.find((v) => v.voucherNo === result.voucherNo);
  assert.ok(found, "newly posted JV must appear in list");
  assert.equal(found.narration, "list test");
});

test("closed-day guard is enforced for JV creation", async () => {
  const { company, financialYear, user, debitAcct, creditAcct } = await fixture();

  // Create a closed day for a specific date
  const closedDate = new Date("2027-02-01");
  const dayClosing = await prisma.dayClosing.create({
    data: { companyId: company.id, financialYearId: financialYear.id, closedDate, closedById: user.id },
  });
  await prisma.auditLog.create({
    data: { companyId: company.id, userId: user.id, action: "CLOSE_DAY", entityType: "DayClosing", entityId: dayClosing.id, after: { status: "closed" } },
  });

  const ctx = { companyId: company.id, financialYearId: financialYear.id, userId: user.id };
  await assert.rejects(
    jv.createJournalVoucher({
      ...ctx,
      voucherDate: "2027-02-01",
      lines: [
        { accountId: debitAcct.id, debit: 100, credit: 0 },
        { accountId: creditAcct.id, debit: 0, credit: 100 },
      ],
    }),
    /closed/i,
  );

  // cleanup
  await prisma.auditLog.deleteMany({ where: { entityId: dayClosing.id } });
  await prisma.dayClosing.delete({ where: { id: dayClosing.id } });
});

// ── API route tests ───────────────────────────────────────────────────────────

test("JV API POST returns 400 for unbalanced voucher", async () => {
  const { user, debitAcct, creditAcct } = await fixture();
  const req = await authedPost(user, "http://localhost/api/accounting/journal-vouchers", {
    voucherDate: "2027-03-01",
    lines: [
      { accountId: debitAcct.id, debit: 100, credit: 0 },
      { accountId: creditAcct.id, debit: 0, credit: 90 },
    ],
  });
  const res = await jvRoute.POST(req);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /balanced/i);
});

test("JV API POST returns 400 for empty lines", async () => {
  const { user } = await fixture();
  const req = await authedPost(user, "http://localhost/api/accounting/journal-vouchers", {
    voucherDate: "2027-03-02",
    lines: [],
  });
  const res = await jvRoute.POST(req);
  assert.equal(res.status, 400);
});

test("JV API POST creates voucher and returns voucherNo for admin user", async () => {
  const { user, debitAcct, creditAcct } = await fixture();
  const req = await authedPost(user, "http://localhost/api/accounting/journal-vouchers", {
    voucherDate: "2027-03-03",
    narration: "API test JV",
    lines: [
      { accountId: debitAcct.id, debit: 750, credit: 0 },
      { accountId: creditAcct.id, debit: 0, credit: 750 },
    ],
  });
  const res = await jvRoute.POST(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.voucherNo, "must return voucherNo");
  assert.ok(body.voucherNo.startsWith("JV-"), `voucherNo must start with JV-, got ${body.voucherNo}`);
  cleanup.voucherNos.add(body.voucherNo);
});

test("JV API GET lists manual JVs for admin user", async () => {
  const { user } = await fixture();
  const req = await authedGet(user, "http://localhost/api/accounting/journal-vouchers");
  const res = await jvRoute.GET(req);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.vouchers), "must return vouchers array");
});

// ── UI source tests ───────────────────────────────────────────────────────────

test("journal voucher page uses JournalVoucherPage component", async () => {
  const root = new URL("../", import.meta.url);
  const page = await readFile(new URL("src/app/(protected)/payments/journal-vouchers/page.tsx", root), "utf8");
  assert.match(page, /JournalVoucherPage/, "page must use JournalVoucherPage");
});

test("JournalVoucherPage component has required UI elements", async () => {
  const root = new URL("../", import.meta.url);
  const src = await readFile(new URL("src/components/JournalVoucherPage.tsx", root), "utf8");

  assert.match(src, /Add Row/, "must have Add Row button");
  assert.match(src, /Remove/, "must have Remove row button");
  assert.match(src, /Balanced|balanced/, "must show balance indicator");
  assert.match(src, /totalDebit/, "must show total debit");
  assert.match(src, /totalCredit/, "must show total credit");
  assert.match(src, /\/api\/accounting\/journal-vouchers/, "must call journal-vouchers API");
  assert.match(src, /Post Journal Voucher/, "must have submit button");
});

test("printable JV page uses journal-voucher document type", async () => {
  const root = new URL("../", import.meta.url);
  const page = await readFile(new URL("src/app/(protected)/payments/journal-vouchers/print/[documentNo]/page.tsx", root), "utf8");
  assert.match(page, /journal-voucher/, "print page must use journal-voucher document type");
  assert.match(page, /PrintableTransactionDocument/, "print page must use PrintableTransactionDocument");
});

test("navigation Journal Vouchers tab points to /payments/journal-vouchers", async () => {
  const root = new URL("../", import.meta.url);
  const nav = await readFile(new URL("src/lib/navigation/modules.ts", root), "utf8");
  assert.match(nav, /\/payments\/journal-vouchers/);
  assert.match(nav, /Journal Vouchers/);
});
