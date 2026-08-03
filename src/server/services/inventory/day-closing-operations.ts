import { AuditAction, PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { getDayClosingTrailStatus, type DayClosingTrailStatus } from "./day-closing.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type ReopenInput = { closedDate?: string | Date; reason?: string };

function dayRange(date: Date) {
  return { gte: date, lt: addDay(date) };
}

function dateOnly(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("closedDate must be a valid date.");
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDay(date: Date) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function trailAfter(status: DayClosingTrailStatus, input?: { closedDate?: Date; reason?: string; previousStatus?: DayClosingTrailStatus }) {
  return {
    status,
    closedDate: input?.closedDate?.toISOString().slice(0, 10),
    reason: input?.reason,
    previousStatus: input?.previousStatus,
  };
}

export async function getDayClosingReconciliation(context: Context, input: { closedDate: string | Date }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "day-closing", PermissionAction.VIEW);
    const closedDate = dateOnly(input.closedDate);
    const voucherWhere = { companyId: context.companyId, financialYearId: context.financialYearId, voucherDate: dayRange(closedDate), isPosted: true };
    const [vouchers, stock, banks, cashAccounts] = await Promise.all([
      tx.accountingVoucher.findMany({ where: voucherWhere, select: { id: true, totalDebit: true, totalCredit: true } }),
      tx.stockLedgerEntry.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId, transactionDate: dayRange(closedDate) }, select: { direction: true, quantity: true } }),
      tx.bank.findMany({ where: { companyId: context.companyId }, select: { accountId: true } }),
      tx.chartAccount.findMany({ where: { companyId: context.companyId, accountType: "ASSET", name: { contains: "Cash", mode: "insensitive" } }, select: { id: true } }),
    ]);
    const cashBankAccountIds = new Set([...banks.map((bank) => bank.accountId), ...cashAccounts.map((account) => account.id)]);
    const cashBankLines = cashBankAccountIds.size
      ? await tx.accountingVoucherLine.findMany({ where: { accountId: { in: [...cashBankAccountIds] }, voucher: voucherWhere }, select: { accountId: true, debit: true, credit: true } })
      : [];
    const cashAccountIds = new Set(cashAccounts.map((account) => account.id));
    const sum = (lines: typeof cashBankLines, ids: Set<string>) => lines.reduce((total, line) => ids.has(line.accountId) ? total + Number(line.debit) - Number(line.credit) : total, 0);
    const stockInQuantity = stock.filter((entry) => entry.direction === "IN").reduce((total, entry) => total + entry.quantity, 0);
    const stockOutQuantity = stock.filter((entry) => entry.direction === "OUT").reduce((total, entry) => total + entry.quantity, 0);
    const unbalancedVoucherCount = vouchers.filter((voucher) => Number(voucher.totalDebit) !== Number(voucher.totalCredit)).length;
    return {
      closedDate: closedDate.toISOString().slice(0, 10),
      voucherCount: vouchers.length,
      unbalancedVoucherCount,
      stockMovementCount: stock.length,
      stockInQuantity,
      stockOutQuantity,
      cashMovement: sum(cashBankLines, cashAccountIds),
      bankMovement: sum(cashBankLines, new Set([...cashBankAccountIds].filter((id) => !cashAccountIds.has(id)))),
      isBalanced: unbalancedVoucherCount === 0,
    };
  });
}

export async function getDayClosingStatus(context: Context) {
  const [financialYear, closings] = await Promise.all([
    prisma.financialYear.findFirstOrThrow({ where: { id: context.financialYearId, companyId: context.companyId } }),
    prisma.dayClosing.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId },
      orderBy: { closedDate: "desc" },
      take: 30,
      include: { closedBy: { select: { id: true, name: true, loginId: true } } },
    }),
  ]);
  const lastClosing = closings[0];
  const history = await Promise.all(closings.map(async (closing) => ({
    id: closing.id,
    closedDate: closing.closedDate,
    closedBy: closing.closedBy,
    cashBalance: closing.cashBalance,
    notes: closing.notes,
    status: await prisma.$transaction((tx) => getDayClosingTrailStatus(tx, closing.id)),
  })));

  return {
    lastClosedDate: lastClosing?.closedDate ?? null,
    lastClosedBy: lastClosing?.closedBy ?? null,
    lastStatus: lastClosing ? await prisma.$transaction((tx) => getDayClosingTrailStatus(tx, lastClosing.id)) : null,
    nextCloseDate: lastClosing ? addDay(lastClosing.closedDate) : financialYear.startsOn,
    history,
  };
}

export async function closeBusinessDay(context: Context, input: { closedDate: string | Date; cashBalance?: number; notes?: string }) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await enforcePermission(tx, context.userId, "day-closing", PermissionAction.CLOSE_DAY);
    const closedDate = dateOnly(input.closedDate);
    const vouchers = await tx.accountingVoucher.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, voucherDate: dayRange(closedDate), isPosted: true },
      select: { totalDebit: true, totalCredit: true },
    });
    const unbalancedVoucherCount = vouchers.filter((voucher) => Number(voucher.totalDebit) !== Number(voucher.totalCredit)).length;
    if (unbalancedVoucherCount > 0) throw new Error(`Cannot close day: ${unbalancedVoucherCount} unbalanced voucher(s) found.`);

    const duplicate = await tx.dayClosing.findUnique({
      where: { companyId_closedDate: { companyId: context.companyId, closedDate } },
      select: { id: true, closedDate: true },
    });
    if (duplicate) {
      const status = await getDayClosingTrailStatus(tx, duplicate.id);
      if (status !== "reopened") throw new Error("This day is already closed.");

      await writeAuditLog(tx, {
        companyId: context.companyId,
        userId: context.userId,
        action: AuditAction.CLOSE_DAY,
        entityType: "DayClosing",
        entityId: duplicate.id,
        before: trailAfter(status, { closedDate }),
        after: trailAfter("reclosed", { closedDate, previousStatus: status, reason: input.notes }),
      });

      return duplicate;
    }

    const previous = await tx.dayClosing.findFirst({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, closedDate: { lt: closedDate } },
      orderBy: { closedDate: "desc" },
      select: { id: true, closedDate: true },
    });
    const previousStatus = previous ? await getDayClosingTrailStatus(tx, previous.id) : undefined;
    if (previous && previousStatus !== "reopened" && addDay(previous.closedDate).getTime() !== closedDate.getTime()) {
      throw new Error("Days must be closed sequentially.");
    }

    const closing = await tx.dayClosing.create({
      data: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        closedDate,
        closedById: context.userId,
        cashBalance: input.cashBalance ?? 0,
        notes: input.notes,
      },
    });

    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.CLOSE_DAY,
      entityType: "DayClosing",
      entityId: closing.id,
      after: { ...closing, status: "closed" },
    });

    return closing;
  });
}

async function findClosingForReopen(tx: Prisma.TransactionClient, context: Context, input?: ReopenInput) {
  if (input?.closedDate) {
    return tx.dayClosing.findUniqueOrThrow({
      where: { companyId_closedDate: { companyId: context.companyId, closedDate: dateOnly(input.closedDate) } },
    });
  }

  return tx.dayClosing.findFirstOrThrow({
    where: { companyId: context.companyId, financialYearId: context.financialYearId },
    orderBy: { closedDate: "desc" },
  });
}

export async function requestDayReopen(context: Context, input: ReopenInput = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "day-closing.reopen", PermissionAction.APPROVE);
    const closing = await findClosingForReopen(tx, context, input);
    const status = await getDayClosingTrailStatus(tx, closing.id);
    if (status === "reopened") throw new Error("This day is already reopened.");

    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "DayClosing",
      entityId: closing.id,
      before: trailAfter(status, { closedDate: closing.closedDate }),
      after: trailAfter("reopen_requested", { closedDate: closing.closedDate, previousStatus: status, reason: input.reason }),
    });

    return { closing, status: "reopen_requested" as const };
  });
}

export async function reopenBusinessDay(context: Context, input: ReopenInput = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "day-closing.reopen", PermissionAction.APPROVE);
    const closing = await findClosingForReopen(tx, context, input);
    const status = await getDayClosingTrailStatus(tx, closing.id);
    if (status === "reopened") throw new Error("This day is already reopened.");

    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "DayClosing",
      entityId: closing.id,
      before: trailAfter(status, { closedDate: closing.closedDate }),
      after: trailAfter("reopened", { closedDate: closing.closedDate, previousStatus: status, reason: input.reason }),
    });

    return { closing, status: "reopened" as const };
  });
}
