import { AuditAction, PermissionAction, RecordStatus, type Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "../../../lib/prisma.ts";
import { hashPassword } from "../../auth/password.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = Prisma.TransactionClient;
type Context = { companyId: string; financialYearId: string; userId: string };

type UserCreateInput = {
  loginId: string;
  name: string;
  password: string;
  email?: string;
  status?: string;
  roleIds?: string[];
};

type UserUpdateInput = {
  loginId?: string;
  name?: string;
  email?: string;
  status?: string;
  roleIds?: string[];
};

function encodePassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(plain, salt);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

function cleanLoginId(value: string) {
  const v = value.trim();
  if (!v) throw new Error("loginId is required.");
  if (v.length < 3 || v.length > 50) throw new Error("loginId must be 3–50 characters.");
  return v;
}

function cleanName(value: string) {
  const v = value.trim();
  if (!v) throw new Error("name is required.");
  return v;
}

function cleanPassword(value: string) {
  if (!value || value.length < 6) throw new Error("password must be at least 6 characters.");
  return value;
}

async function adminPermissionId(tx: Tx) {
  const p = await tx.permission.findUnique({
    where: { module_action: { module: "rbac", action: PermissionAction.MANAGE_RBAC } },
    select: { id: true },
  });
  return p?.id ?? null;
}

async function activeAdminUserCount(tx: Tx, companyId: string, excludeUserId?: string) {
  const permId = await adminPermissionId(tx);
  if (!permId) return 0;
  return tx.user.count({
    where: {
      companyId,
      status: RecordStatus.ACTIVE,
      id: excludeUserId ? { not: excludeUserId } : undefined,
      userRoles: {
        some: {
          role: {
            status: RecordStatus.ACTIVE,
            permissions: { some: { permissionId: permId } },
          },
        },
      },
    },
  });
}

async function userIsAdmin(tx: Tx, userId: string) {
  const permId = await adminPermissionId(tx);
  if (!permId) return false;
  const count = await tx.user.count({
    where: {
      id: userId,
      userRoles: {
        some: {
          role: {
            status: RecordStatus.ACTIVE,
            permissions: { some: { permissionId: permId } },
          },
        },
      },
    },
  });
  return count > 0;
}

async function rolesHaveAdmin(tx: Tx, roleIds: string[]) {
  if (roleIds.length === 0) return false;
  const permId = await adminPermissionId(tx);
  if (!permId) return false;
  const count = await tx.role.count({
    where: {
      id: { in: roleIds },
      status: RecordStatus.ACTIVE,
      permissions: { some: { permissionId: permId } },
    },
  });
  return count > 0;
}

async function serializeUser(tx: Tx, userId: string) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      loginId: true,
      name: true,
      email: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      userRoles: {
        select: { role: { select: { id: true, name: true, status: true } } },
        orderBy: { role: { name: "asc" } },
      },
    },
  });
  return { ...user, roles: user.userRoles.map((ur) => ur.role) };
}

export async function listUsers(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    const users = await tx.user.findMany({
      where: { companyId: context.companyId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        loginId: true,
        name: true,
        email: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          select: { role: { select: { id: true, name: true, status: true } } },
          orderBy: { role: { name: "asc" } },
        },
      },
    });
    return users.map((u) => ({ ...u, roles: u.userRoles.map((ur) => ur.role) }));
  });
}

export async function listRolesForUsers(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    return tx.role.findMany({
      where: { companyId: context.companyId, status: RecordStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  });
}

export async function createUser(context: Context, input: UserCreateInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    const loginId = cleanLoginId(input.loginId);
    const name = cleanName(input.name);
    const password = cleanPassword(input.password);
    const status = input.status === "INACTIVE" ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
    const roleIds = [...new Set((input.roleIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0))];

    const conflict = await tx.user.findFirst({ where: { companyId: context.companyId, loginId }, select: { id: true } });
    if (conflict) throw new Error("loginId already exists.");

    const user = await tx.user.create({
      data: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        loginId,
        name,
        email: input.email?.trim() || null,
        passwordHash: encodePassword(password),
        status,
      },
    });

    for (const roleId of roleIds) {
      await tx.userRole.create({ data: { userId: user.id, roleId } });
    }

    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      entityType: "User",
      entityId: user.id,
      after: { loginId, name, status, roleIds },
    });
    return serializeUser(tx, user.id);
  });
}

export async function updateUser(context: Context, id: string, input: UserUpdateInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    const before = await tx.user.findFirstOrThrow({
      where: { id, companyId: context.companyId },
      select: { id: true, loginId: true, name: true, email: true, status: true },
    });

    const status = input.status === "INACTIVE" ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
    const roleIds = input.roleIds !== undefined
      ? [...new Set(input.roleIds.filter((r): r is string => typeof r === "string" && r.length > 0))]
      : undefined;

    if (status === RecordStatus.INACTIVE) {
      if (id === context.userId) throw new Error("Cannot disable your own account.");
      const remainingAdmins = await activeAdminUserCount(tx, context.companyId, id);
      if (remainingAdmins === 0) throw new Error("Cannot disable the last admin user.");
    }

    if (id === context.userId && roleIds !== undefined) {
      const currentlyAdmin = await userIsAdmin(tx, id);
      if (currentlyAdmin && !(await rolesHaveAdmin(tx, roleIds))) {
        throw new Error("Cannot remove your own admin access.");
      }
    }

    if (input.loginId !== undefined) {
      const loginId = cleanLoginId(input.loginId);
      const dup = await tx.user.findFirst({ where: { companyId: context.companyId, loginId, NOT: { id } }, select: { id: true } });
      if (dup) throw new Error("loginId already exists.");
    }

    const updateData: Record<string, unknown> = { status };
    if (input.loginId !== undefined) updateData.loginId = cleanLoginId(input.loginId);
    if (input.name !== undefined) updateData.name = cleanName(input.name);
    if (input.email !== undefined) updateData.email = input.email.trim() || null;

    await tx.user.update({ where: { id }, data: updateData });

    if (roleIds !== undefined) {
      await tx.userRole.deleteMany({ where: { userId: id, roleId: { notIn: roleIds } } });
      for (const roleId of roleIds) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: id, roleId } },
          update: {},
          create: { userId: id, roleId },
        });
      }
    }

    const after = await serializeUser(tx, id);
    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      before,
      after,
    });
    return after;
  });
}

export async function resetUserPassword(context: Context, id: string, newPassword: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    await tx.user.findFirstOrThrow({ where: { id, companyId: context.companyId }, select: { id: true } });
    const password = cleanPassword(newPassword);
    await tx.user.update({ where: { id }, data: { passwordHash: encodePassword(password) } });
    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "User",
      entityId: id,
      after: { action: "password_reset" },
    });
    return { id };
  });
}

export async function listAreasForMapping(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    return tx.area.findMany({
      where: { companyId: context.companyId, status: RecordStatus.ACTIVE },
      orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, cityId: true, city: { select: { id: true, name: true } } },
    });
  });
}

export async function getUserAreaAssignments(context: Context, targetUserId: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    const user = await tx.user.findFirstOrThrow({
      where: { id: targetUserId, companyId: context.companyId },
      select: { id: true, loginId: true, name: true },
    });
    const assignments = await tx.userArea.findMany({ where: { userId: targetUserId }, select: { areaId: true } });
    return { user, assignedAreaIds: assignments.map((a) => a.areaId) };
  });
}

export async function setUserAreas(context: Context, targetUserId: string, areaIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "rbac", PermissionAction.MANAGE_RBAC);
    await tx.user.findFirstOrThrow({ where: { id: targetUserId, companyId: context.companyId }, select: { id: true } });

    const uniqueIds = [...new Set(areaIds.filter((id): id is string => typeof id === "string" && id.length > 0))];
    if (uniqueIds.length > 0) {
      const valid = await tx.area.findMany({ where: { id: { in: uniqueIds }, companyId: context.companyId }, select: { id: true } });
      if (valid.length !== uniqueIds.length) throw new Error("One or more areas are invalid.");
    }

    const before = await tx.userArea.findMany({ where: { userId: targetUserId }, select: { areaId: true } });

    await tx.userArea.deleteMany({ where: { userId: targetUserId, areaId: { notIn: uniqueIds } } });
    for (const areaId of uniqueIds) {
      await tx.userArea.upsert({
        where: { userId_areaId: { userId: targetUserId, areaId } },
        update: {},
        create: { userId: targetUserId, areaId },
      });
    }

    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "UserArea",
      entityId: targetUserId,
      before: { areaIds: before.map((a) => a.areaId) },
      after: { areaIds: uniqueIds },
    });

    return { userId: targetUserId, areaIds: uniqueIds };
  });
}
