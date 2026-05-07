import { PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";

type Tx = Prisma.TransactionClient;

export type PermissionKey = `${string}:${PermissionAction}`;

export function permissionKey(module: string, action: PermissionAction): PermissionKey {
  return `${module}:${action}`;
}

export async function getUserPermissionKeys(userId: string, tx: Tx | typeof prisma = prisma) {
  const permissions = await tx.permission.findMany({
    where: {
      roles: {
        some: {
          role: {
            status: "ACTIVE",
            userRoles: { some: { userId } },
          },
        },
      },
    },
    select: { module: true, action: true },
  });

  return permissions.map((permission) => permissionKey(permission.module, permission.action));
}

