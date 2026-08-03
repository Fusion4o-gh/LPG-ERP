import { AuditAction, PermissionAction } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

const select = { id: true, label: true, startsOn: true, endsOn: true, isActive: true, isClosed: true, closedAt: true, openingBalancesLockedAt: true, openingBalancesLockedById: true } as const;

function date(value: string, field: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field} must be a valid date.`);
  return parsed;
}

export async function listFinancialYears(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "financial-years", PermissionAction.VIEW);
    return tx.financialYear.findMany({ where: { companyId: context.companyId }, orderBy: { startsOn: "desc" }, select });
  });
}

export async function createFinancialYear(context: Context, input: { label: string; startsOn: string; endsOn: string; isActive?: boolean }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "financial-years", PermissionAction.CREATE);
    const label = input.label.trim();
    if (!label) throw new Error("label is required.");
    const startsOn = date(input.startsOn, "startsOn");
    const endsOn = date(input.endsOn, "endsOn");
    if (endsOn < startsOn) throw new Error("endsOn must be on or after startsOn.");
    const overlap = await tx.financialYear.findFirst({ where: { companyId: context.companyId, startsOn: { lte: endsOn }, endsOn: { gte: startsOn } }, select: { id: true } });
    if (overlap) throw new Error("Financial year dates overlap an existing financial year.");
    const isActive = input.isActive !== false;
    if (isActive) await tx.financialYear.updateMany({ where: { companyId: context.companyId, isClosed: false }, data: { isActive: false } });
    const row = await tx.financialYear.create({ data: { companyId: context.companyId, label, startsOn, endsOn, isActive }, select });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.CREATE, entityType: "FinancialYear", entityId: row.id, after: row });
    return row;
  });
}

export async function lockOpeningBalances(context: Context, financialYearId: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "financial-years", PermissionAction.UPDATE);
    const before = await tx.financialYear.findFirstOrThrow({ where: { id: financialYearId, companyId: context.companyId }, select });
    if (before.isClosed) throw new Error("A closed financial year cannot be changed.");
    if (before.openingBalancesLockedAt) return before;
    const row = await tx.financialYear.update({ where: { id: financialYearId }, data: { openingBalancesLockedAt: new Date(), openingBalancesLockedById: context.userId }, select });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "FinancialYear", entityId: financialYearId, before, after: row });
    return row;
  });
}
