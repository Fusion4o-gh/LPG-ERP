import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient, PermissionAction } from "@prisma/client";

const prisma = new PrismaClient();
const uiPermissions = await import("../src/lib/permissions.ts");
const validation = await import("../src/lib/form-validation.ts");
const dayClosing = await import("../src/server/services/inventory/day-closing-operations.ts");
const dayClosingGuard = await import("../src/server/services/inventory/day-closing.ts");
const auditRead = await import("../src/server/services/audit/audit-read.ts");
const reversalPolicy = await import("../src/server/services/reversals/reversal-policy.ts");

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fixture() {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({ where: { companyId: company.id, isActive: true } });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  return { company, financialYear, user };
}

async function isolatedDayClosingFixture() {
  const suffix = doc("dc").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `Day Closing Test ${suffix}` } });
  const financialYear = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      label: suffix,
      startsOn: new Date("2026-01-01"),
      endsOn: new Date("2026-12-31"),
      isActive: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Day Closing User ${suffix}`,
      loginId: `day-closing-${suffix}`,
      passwordHash: "test",
    },
  });
  return { company, financialYear, user };
}

async function grantPermission(companyId, userId, module, action) {
  const role = await prisma.role.create({ data: { companyId, name: doc("role") } });
  const permission = await prisma.permission.upsert({
    where: { module_action: { module, action } },
    update: {},
    create: { module, action, description: `${module} ${action}` },
  });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("role-aware UI helper gates links by permission keys", () => {
  const permissions = ["customers:VIEW", "sale-lpg:CREATE"];
  assert.equal(uiPermissions.canAccess(permissions, "customers"), true);
  assert.equal(uiPermissions.canAccess(permissions, "vendors"), false);
  assert.equal(uiPermissions.canAccess(permissions, "sale-lpg", "CREATE"), true);
});

test("master-data validation catches required fields and numeric ranges", () => {
  const errors = validation.validateFormValues(
    { code: "", name: "", defaultSecurity: "-1" },
    [
      { name: "code", label: "Code", type: "text", required: true },
      { name: "name", label: "Name", type: "text", required: true },
      { name: "defaultSecurity", label: "Default Security", type: "number", min: 0 },
    ],
  );
  assert.equal(errors.code, "Code is required.");
  assert.equal(errors.name, "Name is required.");
  assert.equal(errors.defaultSecurity, "Default Security must be at least 0.");
});

test("day closing requires close-day permission", async () => {
  const { company, financialYear } = await fixture();
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("No Close"),
      loginId: doc("no-close"),
      passwordHash: "test",
    },
  });

  await assert.rejects(
    dayClosing.closeBusinessDay(
      { companyId: company.id, financialYearId: financialYear.id, userId: deniedUser.id },
      { closedDate: "2026-12-31", cashBalance: 0 },
    ),
    /permission/i,
  );
});

test("audit-log read filters by module and action", async () => {
  const { company, user } = await fixture();
  const entityId = doc("AUDIT");
  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: user.id,
      action: "UPDATE",
      entityType: "Customer",
      entityId,
      before: { name: "Before", passwordHash: "hidden" },
      after: { name: "After" },
    },
  });

  const logs = await auditRead.readAuditLogs({ companyId: company.id }, { module: "Customer", action: "UPDATE" });
  const log = logs.find((entry) => entry.recordReference === entityId);
  assert.ok(log);
  assert.equal(log.module, "Customer");
  assert.equal(log.action, "UPDATE");
  assert.equal(String(log.beforeSummary).includes("passwordHash"), false);
});

test("reversal policy prevents unsafe deletion", () => {
  assert.throws(() => reversalPolicy.deletionIsNeverAReversal(), /Unsafe delete/i);
});

test("reversal policy requires approve permission before stub execution", async () => {
  const { company, financialYear } = await fixture();
  const role = await prisma.role.create({ data: { companyId: company.id, name: doc("sale-view-role") } });
  const permission = await prisma.permission.findUniqueOrThrow({
    where: { module_action: { module: "sale-lpg", action: PermissionAction.VIEW } },
  });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("No Approve"),
      loginId: doc("no-approve"),
      passwordHash: "test",
      userRoles: { create: { roleId: role.id } },
    },
  });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });

  await assert.rejects(
    reversalPolicy.createReversalStub(
      { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
      { kind: "sale", documentNo: "SALE-1", reversalDate: "2026-12-30" },
    ),
    /permission/i,
  );
});

test("normal user cannot reopen a closed business day", async () => {
  const { company, financialYear, user } = await isolatedDayClosingFixture();
  await prisma.dayClosing.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      closedDate: new Date("2026-03-10"),
      closedById: user.id,
    },
  });

  await assert.rejects(
    dayClosing.reopenBusinessDay(
      { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
      { closedDate: "2026-03-10", reason: "Correction" },
    ),
    /permission/i,
  );
});

test("authorized user can request and perform day reopen with audit trail", async () => {
  const { company, financialYear, user } = await isolatedDayClosingFixture();
  await grantPermission(company.id, user.id, "day-closing.reopen", PermissionAction.APPROVE);
  const closing = await prisma.dayClosing.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      closedDate: new Date("2026-03-11"),
      closedById: user.id,
    },
  });

  const request = await dayClosing.requestDayReopen(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { closedDate: "2026-03-11", reason: "Late approved adjustment" },
  );
  const reopen = await dayClosing.reopenBusinessDay(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { closedDate: "2026-03-11", reason: "Approved" },
  );

  assert.equal(request.status, "reopen_requested");
  assert.equal(reopen.status, "reopened");

  const trail = await prisma.auditLog.findMany({
    where: { companyId: company.id, entityType: "DayClosing", entityId: closing.id },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(trail.some((entry) => entry.after?.status === "reopen_requested"), true);
  assert.equal(trail.some((entry) => entry.after?.status === "reopened"), true);
});

test("closed-day write guard respects reopened state and preserves history", async () => {
  const { company, financialYear, user } = await isolatedDayClosingFixture();
  await grantPermission(company.id, user.id, "day-closing.reopen", PermissionAction.APPROVE);
  await grantPermission(company.id, user.id, "day-closing", PermissionAction.CLOSE_DAY);

  const closing = await dayClosing.closeBusinessDay(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { closedDate: "2026-03-12", cashBalance: 0 },
  );

  await assert.rejects(
    prisma.$transaction((tx) =>
      dayClosingGuard.assertWritableBusinessDate(tx, {
        companyId: company.id,
        financialYearId: financialYear.id,
        userId: user.id,
        transactionDate: "2026-03-12",
      }),
    ),
    /closed day/i,
  );

  await dayClosing.reopenBusinessDay(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { closedDate: "2026-03-12", reason: "Approved correction" },
  );

  await prisma.$transaction((tx) =>
    dayClosingGuard.assertWritableBusinessDate(tx, {
      companyId: company.id,
      financialYearId: financialYear.id,
      userId: user.id,
      transactionDate: "2026-03-12",
    }),
  );

  await dayClosing.closeBusinessDay(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { closedDate: "2026-03-12", cashBalance: 0, notes: "Reclose after correction" },
  );

  await assert.rejects(
    prisma.$transaction((tx) =>
      dayClosingGuard.assertWritableBusinessDate(tx, {
        companyId: company.id,
        financialYearId: financialYear.id,
        userId: user.id,
        transactionDate: "2026-03-12",
      }),
    ),
    /closed day/i,
  );

  const persistedRows = await prisma.dayClosing.count({ where: { id: closing.id } });
  const trail = await prisma.auditLog.findMany({ where: { entityType: "DayClosing", entityId: closing.id } });
  assert.equal(persistedRows, 1);
  assert.equal(trail.some((entry) => entry.after?.status === "closed"), true);
  assert.equal(trail.some((entry) => entry.after?.status === "reopened"), true);
  assert.equal(trail.some((entry) => entry.after?.status === "reclosed"), true);
});
