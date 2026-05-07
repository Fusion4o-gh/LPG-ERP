import { PermissionAction, type Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export class PermissionDeniedError extends Error {
  constructor(module: string, action: PermissionAction) {
    super(`User does not have ${action} permission for ${module}.`);
    this.name = "PermissionDeniedError";
  }
}

export async function enforcePermission(tx: Tx, userId: string, module: string, action: PermissionAction) {
  const permission = await tx.rolePermission.findFirst({
    where: {
      role: {
        userRoles: { some: { userId } },
        status: "ACTIVE",
      },
      permission: { module, action },
    },
    select: { id: true },
  });

  if (!permission) {
    throw new PermissionDeniedError(module, action);
  }
}
