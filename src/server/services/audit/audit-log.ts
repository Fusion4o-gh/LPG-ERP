import { AuditAction, type Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type AuditInput = {
  companyId: string;
  userId?: string;
  action?: AuditAction;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

export async function writeAuditLog(tx: Tx, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action ?? AuditAction.CREATE,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
    },
  });
}
