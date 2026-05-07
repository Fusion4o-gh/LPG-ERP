import { PermissionAction, type Prisma } from "@prisma/client";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = Prisma.TransactionClient;

type GuardInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

export type DayClosingTrailStatus = "closed" | "reopen_requested" | "reopened" | "reclosed";

const trailStatuses = new Set<DayClosingTrailStatus>(["closed", "reopen_requested", "reopened", "reclosed"]);

function trailStatusFromAuditValue(value: unknown): DayClosingTrailStatus | undefined {
  if (!value || typeof value !== "object") return undefined;
  const status = (value as { status?: unknown }).status;
  return typeof status === "string" && trailStatuses.has(status as DayClosingTrailStatus)
    ? (status as DayClosingTrailStatus)
    : undefined;
}

export async function getDayClosingTrailStatus(tx: Tx, closingId: string): Promise<DayClosingTrailStatus> {
  const trail = await tx.auditLog.findMany({
    where: { entityType: "DayClosing", entityId: closingId },
    orderBy: { createdAt: "desc" },
    select: { after: true },
    take: 25,
  });

  for (const entry of trail) {
    const status = trailStatusFromAuditValue(entry.after);
    if (status) return status;
  }

  return "closed";
}

export async function assertWritableBusinessDate(tx: Tx, input: GuardInput) {
  const closedDays = await tx.dayClosing.findMany({
    where: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      closedDate: { gte: new Date(input.transactionDate) },
    },
    select: { id: true, closedDate: true },
    orderBy: { closedDate: "asc" },
  });

  if (closedDays.length === 0) {
    return;
  }

  for (const closedDay of closedDays) {
    const status = await getDayClosingTrailStatus(tx, closedDay.id);
    if (status === "reopened") {
      continue;
    }

    if (input.allowClosedDayOverride) {
      await enforcePermission(tx, input.userId, "day-closing.override", PermissionAction.APPROVE);
      return;
    }

    throw new Error("Backdated writes before or on a closed day are not allowed.");
  }
}
