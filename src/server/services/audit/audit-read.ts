import { AuditAction } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";

type Context = { companyId: string };

function safeSummary(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const object = value as Record<string, unknown>;
  return Object.entries(object)
    .filter(([key]) => !/password|token|secret|hash/i.test(key))
    .slice(0, 5)
    .map(([key, item]) => `${key}: ${typeof item === "object" ? "[object]" : String(item)}`)
    .join(", ");
}

export async function readAuditLogs(
  context: Context,
  filters: { module?: string; action?: string; userId?: string; from?: string; to?: string },
) {
  const action = filters.action && Object.values(AuditAction).includes(filters.action as AuditAction) ? (filters.action as AuditAction) : undefined;
  const logs = await prisma.auditLog.findMany({
    where: {
      companyId: context.companyId,
      entityType: filters.module || undefined,
      action,
      userId: filters.userId || undefined,
      createdAt: {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      },
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, loginId: true } } },
    take: 200,
  });

  return logs.map((log) => ({
    id: log.id,
    timestamp: log.createdAt,
    user: log.user ? `${log.user.name} (${log.user.loginId})` : "System",
    module: log.entityType,
    action: log.action,
    recordReference: log.entityId,
    beforeSummary: safeSummary(log.before),
    afterSummary: safeSummary(log.after),
  }));
}

