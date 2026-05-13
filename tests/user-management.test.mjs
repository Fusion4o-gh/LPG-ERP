import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const users = await import("../src/server/services/user-management/user-management.ts");
const sessions = await import("../src/server/auth/session.ts");

async function fixture() {
  const suffix = doc("um").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `UM Test ${suffix}`, stockAvailableCheck: false } });
  const financialYear = await prisma.financialYear.create({
    data: { companyId: company.id, label: suffix, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isActive: true },
  });
  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `UM Admin ${suffix}`,
      loginId: `um-admin-${suffix}`,
      passwordHash: "test",
    },
  });
  const adminRole = await prisma.role.create({ data: { companyId: company.id, name: `Admin ${suffix}` } });
  const rbacPermission = await prisma.permission.upsert({
    where: { module_action: { module: "rbac", action: PermissionAction.MANAGE_RBAC } },
    update: {},
    create: { module: "rbac", action: PermissionAction.MANAGE_RBAC },
  });
  await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: rbacPermission.id } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

  const otherRole = await prisma.role.create({ data: { companyId: company.id, name: `Staff ${suffix}` } });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: admin.id };
  return { company, financialYear, admin, adminRole, otherRole, rbacPermission, context };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("create user creates user with audit log", async () => {
  const { company, context, otherRole } = await fixture();
  const loginId = doc("newuser");
  const user = await users.createUser(context, {
    loginId,
    name: "New User",
    password: "secret123",
    status: "ACTIVE",
    roleIds: [otherRole.id],
  });

  assert.equal(user.loginId, loginId);
  assert.equal(user.name, "New User");
  assert.equal(user.status, "ACTIVE");
  assert.equal(user.roles.length, 1);
  assert.equal(user.roles[0].id, otherRole.id);

  const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, entityType: "User", entityId: user.id } });
  assert.ok(audit);
  assert.equal(audit.action, "CREATE");
});

test("edit user updates fields and writes audit log", async () => {
  const { company, context, otherRole } = await fixture();
  const created = await users.createUser(context, { loginId: doc("edit-u"), name: "Before Edit", password: "pass123" });

  const updated = await users.updateUser(context, created.id, {
    name: "After Edit",
    email: "edit@test.com",
    status: "ACTIVE",
    roleIds: [otherRole.id],
  });

  assert.equal(updated.name, "After Edit");
  assert.equal(updated.email, "edit@test.com");
  assert.equal(updated.roles.length, 1);

  const audit = await prisma.auditLog.findFirst({
    where: { companyId: company.id, entityType: "User", entityId: created.id, action: "UPDATE" },
  });
  assert.ok(audit);
});

test("reset password updates password hash", async () => {
  const { company, context } = await fixture();
  const created = await users.createUser(context, { loginId: doc("reset-u"), name: "Reset User", password: "oldpass1" });

  const { id } = await users.resetUserPassword(context, created.id, "newpass123");
  assert.equal(id, created.id);

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: created.id }, select: { passwordHash: true } });
  assert.ok(dbUser.passwordHash?.startsWith("scrypt$"));

  const audit = await prisma.auditLog.findFirst({
    where: { companyId: company.id, entityType: "User", entityId: created.id, action: "UPDATE" },
  });
  assert.ok(audit);
});

test("duplicate username rejected", async () => {
  const { context } = await fixture();
  const loginId = doc("dup-u");
  await users.createUser(context, { loginId, name: "First", password: "pass123" });

  await assert.rejects(
    users.createUser(context, { loginId, name: "Second", password: "pass123" }),
    /loginId already exists/i,
  );
});

test("cannot disable final admin user", async () => {
  const { context, admin } = await fixture();

  await assert.rejects(
    users.updateUser(context, admin.id, { status: "INACTIVE" }),
    /Cannot disable your own account/i,
  );
});

test("can disable admin user when another admin remains", async () => {
  const { company, financialYear, context, admin, adminRole } = await fixture();
  const other = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "Other Admin", loginId: doc("other-admin"), passwordHash: "test" },
  });
  await prisma.userRole.create({ data: { userId: other.id, roleId: adminRole.id } });

  const otherContext = { companyId: company.id, financialYearId: financialYear.id, userId: other.id };

  const updated = await users.updateUser(otherContext, admin.id, { status: "INACTIVE" });
  assert.equal(updated.status, "INACTIVE");
});

test("cannot remove own admin access", async () => {
  const { context, admin, otherRole } = await fixture();

  await assert.rejects(
    users.updateUser(context, admin.id, { roleIds: [otherRole.id] }),
    /Cannot remove your own admin access/i,
  );
});

test("inactive user cannot obtain a valid session", async () => {
  const { company, financialYear, context } = await fixture();
  const created = await users.createUser(context, { loginId: doc("inactive-u"), name: "Inactive User", password: "pass123" });

  const session = await sessions.createSession(created.id);
  const ctx = await sessions.getSessionContextFromToken(session.sessionToken);
  assert.ok(ctx, "should have session when active");

  await users.updateUser(context, created.id, { status: "INACTIVE" });
  const ctxAfter = await sessions.getSessionContextFromToken(session.sessionToken);
  assert.equal(ctxAfter, null, "inactive user should not get session context");
});

test("unauthorized user denied for user management", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "No Perm", loginId: doc("noperm-u"), passwordHash: "test" },
  });
  const noPermContext = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };

  await assert.rejects(users.listUsers(noPermContext), /permission/i);
  await assert.rejects(users.createUser(noPermContext, { loginId: doc("x"), name: "X", password: "pass123" }), /permission/i);
});

test("invalid password rejected", async () => {
  const { context } = await fixture();
  await assert.rejects(
    users.createUser(context, { loginId: doc("short-pw"), name: "Short PW", password: "abc" }),
    /password must be at least 6/i,
  );
  await assert.rejects(
    users.resetUserPassword(context, context.userId, "12345"),
    /password must be at least 6/i,
  );
});
