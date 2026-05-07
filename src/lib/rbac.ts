import { PermissionAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function userCan(userId: string, module: string, action: PermissionAction) {
  const permission = await prisma.rolePermission.findFirst({
    where: {
      role: { userRoles: { some: { userId } } },
      permission: { module, action },
    },
    select: { id: true },
  });

  return Boolean(permission);
}
