import { AuditAction, PermissionAction, RecordStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "./enforce.ts";

type Tx = Prisma.TransactionClient;
type Context = { companyId: string; financialYearId: string; userId: string };
type RoleInput = {
  name?: string;
  description?: string;
  status?: keyof typeof RecordStatus;
  permissionIds?: string[];
  userIds?: string[];
};

function cleanName(value?: string) {
  if (!value?.trim()) throw new Error("name is required.");
  return value.trim();
}

function cleanStatus(value?: keyof typeof RecordStatus) {
  return value === "INACTIVE" ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
}

function uniqueIds(values?: string[]) {
  return [...new Set((values ?? []).filter((value) => typeof value === "string" && value.trim() !== ""))];
}

async function rbacPermissionId(tx: Tx) {
  const permission = await tx.permission.findUniqueOrThrow({
    where: { module_action: { module: "rbac", action: PermissionAction.MANAGE_RBAC } },
    select: { id: true },
  });
  return permission.id;
}

async function roleHasRbacPermission(tx: Tx, roleId: string) {
  const permissionId = await rbacPermissionId(tx);
  const permission = await tx.rolePermission.findUnique({
    where: { roleId_permissionId: { roleId, permissionId } },
    select: { id: true },
  });
  return Boolean(permission);
}

async function activeAdminRoleCount(tx: Tx, companyId: string, excludingRoleId?: string) {
  const permissionId = await rbacPermissionId(tx);
  return tx.role.count({
    where: {
      companyId,
      status: RecordStatus.ACTIVE,
      id: excludingRoleId ? { not: excludingRoleId } : undefined,
      permissions: { some: { permissionId } },
      userRoles: { some: { user: { status: RecordStatus.ACTIVE } } },
    },
  });
}

async function userHasOtherAdminAccess(tx: Tx, userId: string, excludingRoleId: string) {
  const permissionId = await rbacPermissionId(tx);
  const access = await tx.userRole.findFirst({
    where: {
      userId,
      roleId: { not: excludingRoleId },
      role: {
        status: RecordStatus.ACTIVE,
        permissions: { some: { permissionId } },
      },
    },
    select: { id: true },
  });
  return Boolean(access);
}

async function assertSafeAdminChange(
  tx: Tx,
  context: Context,
  roleId: string,
  next: { status?: RecordStatus; permissionIds?: string[]; userIds?: string[] },
) {
  const hasAdminPermission = await roleHasRbacPermission(tx, roleId);
  if (!hasAdminPermission) return;

  const permissionId = await rbacPermissionId(tx);
  const removesAdminPermission = next.permissionIds ? !next.permissionIds.includes(permissionId) : false;
  const deactivatesRole = next.status === RecordStatus.INACTIVE;
  const assignedUsers = await tx.userRole.findMany({ where: { roleId }, select: { userId: true } });
  const nextUserIds = next.userIds ?? assignedUsers.map((assignment) => assignment.userId);
  const removesCurrentUser = assignedUsers.some((assignment) => assignment.userId === context.userId) && !nextUserIds.includes(context.userId);

  if (!removesAdminPermission && !deactivatesRole && nextUserIds.length > 0) return;

  const remainingAdminRoles = await activeAdminRoleCount(tx, context.companyId, roleId);
  if (remainingAdminRoles === 0) {
    throw new Error("Cannot remove the last admin role.");
  }

  if (removesCurrentUser && !(await userHasOtherAdminAccess(tx, context.userId, roleId))) {
    throw new Error("Current user cannot remove their own admin access.");
  }
}

export async function listPermissions(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    return tx.permission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
      select: { id: true, module: true, action: true, description: true },
    });
  });
}

export async function listRoles(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    return tx.role.findMany({
      where: { companyId: context.companyId },
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: true }, orderBy: { permission: { module: "asc" } } },
        userRoles: { include: { user: { select: { id: true, name: true, loginId: true, status: true } } }, orderBy: { user: { name: "asc" } } },
      },
    });
  });
}

export async function getRole(context: Context, roleId: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    return tx.role.findFirstOrThrow({
      where: { id: roleId, companyId: context.companyId },
      include: {
        permissions: { include: { permission: true } },
        userRoles: { include: { user: { select: { id: true, name: true, loginId: true, status: true } } } },
      },
    });
  });
}

export async function listAssignableUsers(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    return tx.user.findMany({
      where: { companyId: context.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, loginId: true, status: true },
    });
  });
}

export async function createRole(context: Context, input: RoleInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    const role = await tx.role.create({
      data: {
        companyId: context.companyId,
        name: cleanName(input.name),
        description: input.description,
        status: cleanStatus(input.status),
      },
    });

    await applyRoleAssignments(tx, role.id, input.permissionIds, input.userIds);
    const after = await getRoleSnapshot(tx, role.id);
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Role", entityId: role.id, after });
    return after;
  });
}

export async function updateRole(context: Context, roleId: string, input: RoleInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    const before = await getRoleSnapshot(tx, roleId, context.companyId);
    const status = cleanStatus(input.status);
    const permissionIds = input.permissionIds ? uniqueIds(input.permissionIds) : undefined;
    const userIds = input.userIds ? uniqueIds(input.userIds) : undefined;
    await assertSafeAdminChange(tx, context, roleId, { status, permissionIds, userIds });

    await tx.role.update({
      where: { id: roleId },
      data: {
        name: cleanName(input.name),
        description: input.description,
        status,
      },
    });
    await applyRoleAssignments(tx, roleId, permissionIds, userIds);

    const after = await getRoleSnapshot(tx, roleId);
    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "Role",
      entityId: roleId,
      before,
      after,
    });
    return after;
  });
}

export async function removeRole(context: Context, roleId: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    const before = await getRoleSnapshot(tx, roleId, context.companyId);
    await assertSafeAdminChange(tx, context, roleId, { status: RecordStatus.INACTIVE, userIds: [] });
    const role = await tx.role.update({ where: { id: roleId }, data: { status: RecordStatus.INACTIVE } });
    const after = await getRoleSnapshot(tx, role.id);
    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "Role",
      entityId: role.id,
      before,
      after,
    });
    return after;
  });
}

async function applyRoleAssignments(tx: Tx, roleId: string, permissionIds?: string[], userIds?: string[]) {
  if (permissionIds) {
    await tx.rolePermission.deleteMany({ where: { roleId, permissionId: { notIn: permissionIds } } });
    for (const permissionId of permissionIds) {
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  if (userIds) {
    await tx.userRole.deleteMany({ where: { roleId, userId: { notIn: userIds } } });
    for (const userId of userIds) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        update: {},
        create: { userId, roleId },
      });
    }
  }
}

async function getRoleSnapshot(tx: Tx, roleId: string, companyId?: string) {
  const role = await tx.role.findFirstOrThrow({
    where: { id: roleId, companyId },
    include: {
      permissions: { include: { permission: true }, orderBy: { permission: { module: "asc" } } },
      userRoles: { include: { user: { select: { id: true, name: true, loginId: true, status: true } } }, orderBy: { user: { name: "asc" } } },
    },
  });

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    status: role.status,
    isSystem: role.isSystem,
    permissions: role.permissions.map(({ permission }) => permission),
    users: role.userRoles.map(({ user }) => user),
  };
}
