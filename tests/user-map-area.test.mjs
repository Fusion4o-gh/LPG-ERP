import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const users = await import("../src/server/services/user-management/user-management.ts");

async function fixture() {
  const suffix = doc("ma").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `MapArea Test ${suffix}`, stockAvailableCheck: false } });
  const financialYear = await prisma.financialYear.create({
    data: { companyId: company.id, label: suffix, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isActive: true },
  });
  const admin = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: `MA Admin ${suffix}`, loginId: `ma-admin-${suffix}`, passwordHash: "test" },
  });
  const adminRole = await prisma.role.create({ data: { companyId: company.id, name: `Admin ${suffix}` } });
  const rbacPermission = await prisma.permission.upsert({
    where: { module_action: { module: "rbac", action: PermissionAction.MANAGE_RBAC } },
    update: {},
    create: { module: "rbac", action: PermissionAction.MANAGE_RBAC },
  });
  await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: rbacPermission.id } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

  const targetUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: `MA Target ${suffix}`, loginId: `ma-target-${suffix}`, passwordHash: "test" },
  });

  const city = await prisma.city.create({ data: { companyId: company.id, name: `City ${suffix}` } });
  const area1 = await prisma.area.create({ data: { companyId: company.id, cityId: city.id, name: `Area A ${suffix}` } });
  const area2 = await prisma.area.create({ data: { companyId: company.id, cityId: city.id, name: `Area B ${suffix}` } });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: admin.id };
  return { company, financialYear, context, admin, targetUser, city, area1, area2 };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("list areas for mapping returns active areas with city", async () => {
  const { context, area1, area2 } = await fixture();
  const areas = await users.listAreasForMapping(context);

  const ids = areas.map((a) => a.id);
  assert.ok(ids.includes(area1.id));
  assert.ok(ids.includes(area2.id));
  assert.ok(areas.every((a) => a.city && a.city.name));
});

test("assign area to user and read back", async () => {
  const { company, context, targetUser, area1 } = await fixture();
  const result = await users.setUserAreas(context, targetUser.id, [area1.id]);

  assert.ok(result.areaIds.includes(area1.id));
  assert.equal(result.userId, targetUser.id);

  const { assignedAreaIds } = await users.getUserAreaAssignments(context, targetUser.id);
  assert.ok(assignedAreaIds.includes(area1.id));

  const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, entityType: "UserArea", entityId: targetUser.id } });
  assert.ok(audit);
  assert.equal(audit.action, "UPDATE");
});

test("remove area from user by setting subset", async () => {
  const { context, targetUser, area1, area2 } = await fixture();
  await users.setUserAreas(context, targetUser.id, [area1.id, area2.id]);

  const result = await users.setUserAreas(context, targetUser.id, [area2.id]);
  assert.deepEqual(result.areaIds, [area2.id]);

  const { assignedAreaIds } = await users.getUserAreaAssignments(context, targetUser.id);
  assert.equal(assignedAreaIds.includes(area1.id), false);
  assert.ok(assignedAreaIds.includes(area2.id));
});

test("remove all areas by setting empty list", async () => {
  const { context, targetUser, area1 } = await fixture();
  await users.setUserAreas(context, targetUser.id, [area1.id]);

  const result = await users.setUserAreas(context, targetUser.id, []);
  assert.deepEqual(result.areaIds, []);

  const { assignedAreaIds } = await users.getUserAreaAssignments(context, targetUser.id);
  assert.equal(assignedAreaIds.length, 0);
});

test("audit log written on area assignment", async () => {
  const { company, context, targetUser, area1, area2 } = await fixture();
  await users.setUserAreas(context, targetUser.id, [area1.id]);
  await users.setUserAreas(context, targetUser.id, [area1.id, area2.id]);

  const logs = await prisma.auditLog.findMany({ where: { companyId: company.id, entityType: "UserArea", entityId: targetUser.id } });
  assert.equal(logs.length, 2);
});

test("invalid area id rejected", async () => {
  const { context, targetUser } = await fixture();
  await assert.rejects(
    users.setUserAreas(context, targetUser.id, ["non-existent-area-id"]),
    /invalid/i,
  );
});

test("unauthorized user denied for map area", async () => {
  const { company, financialYear, targetUser, area1 } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "No Perm MA", loginId: doc("noperm-ma"), passwordHash: "test" },
  });
  const noPermContext = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };

  await assert.rejects(users.listAreasForMapping(noPermContext), /permission/i);
  await assert.rejects(users.setUserAreas(noPermContext, targetUser.id, [area1.id]), /permission/i);
});

test("user management page exposes Map Area action", async () => {
  const root = new URL("../", import.meta.url);
  const client = await readFile(new URL("src/app/(protected)/configuration/user-management/UserManagementClient.tsx", root), "utf8");
  assert.match(client, /Map Area/);
  assert.match(client, /map-area/);
});
