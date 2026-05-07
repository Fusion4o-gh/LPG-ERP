import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const rbac = await import("../src/server/services/rbac/role-management.ts");
const rolesRoute = await import("../src/app/api/rbac/roles/route.ts");
const permissionsRoute = await import("../src/app/api/rbac/permissions/route.ts");

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function seedFixture() {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({ where: { companyId: company.id, isActive: true } });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  return { company, financialYear, user };
}

async function isolatedAdminFixture() {
  const suffix = doc("rbac").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `RBAC Test ${suffix}` } });
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
      name: `RBAC Admin ${suffix}`,
      loginId: `rbac-admin-${suffix}`,
      passwordHash: "test",
    },
  });
  const role = await prisma.role.create({ data: { companyId: company.id, name: `Admin ${suffix}`, isSystem: true } });
  const permission = await prisma.permission.upsert({
    where: { module_action: { module: "rbac", action: PermissionAction.MANAGE_RBAC } },
    update: {},
    create: { module: "rbac", action: PermissionAction.MANAGE_RBAC },
  });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return { company, financialYear, user, role, permission };
}

async function authedGet(user) {
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/rbac/test", { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("role list API works for RBAC managers", async () => {
  const { user } = await seedFixture();
  const response = await rolesRoute.GET(await authedGet(user));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.roles.some((role) => role.name === "Admin"));
  assert.ok(Array.isArray(body.users));
});

test("permission list API works for RBAC managers", async () => {
  const { user } = await seedFixture();
  const response = await permissionsRoute.GET(await authedGet(user));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.permissions.some((permission) => permission.module === "rbac" && permission.action === PermissionAction.MANAGE_RBAC));
});

test("cannot remove the last admin role", async () => {
  const { company, financialYear, user, role } = await isolatedAdminFixture();

  await assert.rejects(
    rbac.removeRole({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, role.id),
    /last admin/i,
  );
});

test("current user cannot remove their own admin access", async () => {
  const { company, financialYear, user, role, permission } = await isolatedAdminFixture();
  const otherUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("Other Admin"),
      loginId: doc("other-admin"),
      passwordHash: "test",
    },
  });
  const otherRole = await prisma.role.create({ data: { companyId: company.id, name: doc("Other Admin Role") } });
  await prisma.rolePermission.create({ data: { roleId: otherRole.id, permissionId: permission.id } });
  await prisma.userRole.create({ data: { userId: otherUser.id, roleId: otherRole.id } });

  await assert.rejects(
    rbac.updateRole(
      { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
      role.id,
      { name: role.name, status: "ACTIVE", permissionIds: [permission.id], userIds: [] },
    ),
    /own admin access/i,
  );
});

test("permission change writes audit log", async () => {
  const { company, financialYear, user } = await seedFixture();
  const viewPermission = await prisma.permission.findFirstOrThrow({ where: { module: "customers", action: PermissionAction.VIEW } });
  const createPermission = await prisma.permission.findFirstOrThrow({ where: { module: "customers", action: PermissionAction.CREATE } });
  const role = await rbac.createRole(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    { name: doc("RBAC Audit"), status: "ACTIVE", permissionIds: [viewPermission.id], userIds: [] },
  );

  await rbac.updateRole(
    { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
    role.id,
    { name: role.name, status: "ACTIVE", permissionIds: [viewPermission.id, createPermission.id], userIds: [] },
  );

  const audit = await prisma.auditLog.findFirst({
    where: { companyId: company.id, entityType: "Role", entityId: role.id, action: "UPDATE" },
  });
  assert.ok(audit);
});

test("unauthorized user is denied RBAC management", async () => {
  const { company, financialYear } = await seedFixture();
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("No RBAC"),
      loginId: doc("no-rbac"),
      passwordHash: "test",
    },
  });

  await assert.rejects(
    rbac.listRoles({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }),
    /permission/i,
  );
});
