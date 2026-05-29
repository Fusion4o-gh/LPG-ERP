import { NormalBalance, PermissionAction } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { parseReportFilters, type ReportFilters } from "./operational-reports.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type LedgerFilters = ReportFilters & { level?: string; groupName?: string };

function amount(value: unknown) {
  return Number(value ?? 0);
}

function voucherDateWhere(filters: ReturnType<typeof parseReportFilters>) {
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

function signedBalance(normalBalance: NormalBalance, debit: number, credit: number) {
  return normalBalance === NormalBalance.CREDIT ? credit - debit : debit - credit;
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function getChartOfAccountReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const level = input.level ? Number(input.level) : undefined;
    const accounts = await tx.chartAccount.findMany({
      where: {
        companyId: context.companyId,
        ...(level ? { level } : {}),
        status: "ACTIVE",
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, level: true, accountType: true, normalBalance: true, parentId: true },
    });

    const grouped = await tx.accountingVoucherLine.groupBy({
      by: ["accountId"],
      where: {
        accountId: { in: accounts.map((a) => a.id) },
        voucher: {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          isPosted: true,
          voucherDate: voucherDateWhere(filters),
        },
      },
      _sum: { debit: true, credit: true },
    });
    const sums = new Map(grouped.map((row) => [row.accountId, row._sum]));

    const rows = accounts.map((account) => {
      const totals = sums.get(account.id);
      const debit = amount(totals?.debit);
      const credit = amount(totals?.credit);
      const balance = signedBalance(account.normalBalance, debit, credit);
      return {
        id: account.id,
        accountCode: account.code,
        accountName: account.name,
        level: account.level,
        accountType: account.accountType,
        periodDebit: debit,
        periodCredit: credit,
        balance,
      };
    });

    return { rows };
  });
}

export async function getGroupSummaryReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const groupName = input.groupName?.trim();
    if (!groupName) throw new Error("groupName is required.");

    const roots = await tx.chartAccount.findMany({
      where: {
        companyId: context.companyId,
        name: { contains: groupName, mode: "insensitive" },
        isControl: true,
      },
      select: { id: true, code: true, name: true, accountType: true, normalBalance: true },
    });
    if (roots.length === 0) throw new Error("No matching account group found.");

    const allAccounts = await tx.chartAccount.findMany({
      where: { companyId: context.companyId },
      select: { id: true, code: true, name: true, parentId: true, accountType: true, normalBalance: true, level: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const account of allAccounts) {
      if (!account.parentId) continue;
      const list = childrenByParent.get(account.parentId) ?? [];
      list.push(account.id);
      childrenByParent.set(account.parentId, list);
    }

    function collectDescendants(rootId: string) {
      const ids: string[] = [];
      const queue = [rootId];
      while (queue.length) {
        const current = queue.shift() as string;
        ids.push(current);
        for (const child of childrenByParent.get(current) ?? []) queue.push(child);
      }
      return ids;
    }

    const grouped = await tx.accountingVoucherLine.groupBy({
      by: ["accountId"],
      where: {
        voucher: {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          isPosted: true,
          voucherDate: voucherDateWhere(filters),
        },
      },
      _sum: { debit: true, credit: true },
    });
    const sums = new Map(grouped.map((row) => [row.accountId, row._sum]));

    const rows = roots.map((root) => {
      const accountIds = collectDescendants(root.id);
      let debit = 0;
      let credit = 0;
      for (const accountId of accountIds) {
        const totals = sums.get(accountId);
        debit += amount(totals?.debit);
        credit += amount(totals?.credit);
      }
      const balance = signedBalance(root.normalBalance, debit, credit);
      return {
        id: root.id,
        groupCode: root.code,
        groupName: root.name,
        accountType: root.accountType,
        periodDebit: debit,
        periodCredit: credit,
        balance,
        accountCount: accountIds.length,
      };
    });

    return { rows };
  });
}

export async function getChartOfAccountReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getChartOfAccountReport(context, input);
  return toCsv(
    ["Account Code", "Account Name", "Level", "Type", "Period Debit", "Period Credit", "Balance"],
    report.rows.map((row) => [row.accountCode, row.accountName, row.level, row.accountType, row.periodDebit, row.periodCredit, row.balance]),
  );
}

export async function getGroupSummaryReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getGroupSummaryReport(context, input);
  return toCsv(
    ["Group Code", "Group Name", "Type", "Accounts", "Period Debit", "Period Credit", "Balance"],
    report.rows.map((row) => [row.groupCode, row.groupName, row.accountType, row.accountCount, row.periodDebit, row.periodCredit, row.balance]),
  );
}
