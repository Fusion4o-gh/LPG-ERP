import { NormalBalance, PermissionAction, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { parseReportFilters, type ReportFilters } from "./operational-reports.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type LedgerFilters = ReportFilters & { level?: string; groupName?: string };
type AccountingReportFilters = ReportFilters & { voucherType?: string; accountId?: string; accountIds?: string; userId?: string; voucherFrom?: string; voucherTo?: string };

function voucherTypeFilter(value?: string) {
  if (!value) return undefined;
  if (!Object.values(VoucherType).includes(value as VoucherType)) throw new Error("voucherType must be a valid voucher type.");
  return value as VoucherType;
}

function accountLevelFilter(value?: string) {
  if (!value?.trim()) return undefined;
  if (!/^[1-4]$/.test(value.trim())) throw new Error("level must be one of 1, 2, 3, or 4.");
  return Number(value);
}

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
    const level = accountLevelFilter(input.level);
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

export async function getUnbalancedVoucherReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const vouchers = await tx.accountingVoucher.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        isPosted: true,
        voucherDate: voucherDateWhere(filters),
      },
      orderBy: [{ voucherDate: "asc" }, { createdAt: "asc" }],
      take: 2000,
      select: {
        id: true,
        voucherNo: true,
        voucherType: true,
        voucherDate: true,
        totalDebit: true,
        totalCredit: true,
        sourceType: true,
        sourceId: true,
        narration: true,
      },
    });

    return vouchers
      .map((voucher) => {
        const debit = amount(voucher.totalDebit);
        const credit = amount(voucher.totalCredit);
        return {
          id: voucher.id,
          voucherNo: voucher.voucherNo,
          voucherType: voucher.voucherType,
          voucherDate: voucher.voucherDate,
          totalDebit: debit,
          totalCredit: credit,
          difference: debit - credit,
          sourceType: voucher.sourceType ?? "",
          sourceId: voucher.sourceId ?? "",
          narration: voucher.narration ?? "",
        };
      })
      .filter((voucher) => Math.abs(voucher.difference) >= 0.005);
  });
}

export async function getUnbalancedVoucherReportCsv(context: Context, input: ReportFilters = {}) {
  const rows = await getUnbalancedVoucherReport(context, input);
  return toCsv(
    ["Voucher No", "Date", "Type", "Debit", "Credit", "Difference", "Source Type", "Source ID", "Narration"],
    rows.map((row) => [
      row.voucherNo,
      row.voucherDate.toISOString().slice(0, 10),
      row.voucherType,
      row.totalDebit.toFixed(2),
      row.totalCredit.toFixed(2),
      row.difference.toFixed(2),
      row.sourceType,
      row.sourceId,
      row.narration,
    ]),
  );
}

export async function getTransactionsListingReport(context: Context, input: AccountingReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const vouchers = await tx.accountingVoucher.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        isPosted: true,
        voucherDate: voucherDateWhere(filters),
        ...(voucherTypeFilter(input.voucherType) ? { voucherType: voucherTypeFilter(input.voucherType) } : {}),
        ...(input.userId ? { createdById: input.userId } : {}),
        ...(input.voucherFrom || input.voucherTo ? { voucherNo: { ...(input.voucherFrom ? { gte: input.voucherFrom } : {}), ...(input.voucherTo ? { lte: input.voucherTo } : {}) } } : {}),
      },
      orderBy: [{ voucherDate: "asc" }, { createdAt: "asc" }],
      take: 5000,
      select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, totalDebit: true, totalCredit: true, sourceType: true, sourceId: true, narration: true, _count: { select: { lines: true } } },
    });
    return { rows: vouchers.map((voucher) => ({
      id: voucher.id,
      voucherNo: voucher.voucherNo,
      voucherType: voucher.voucherType,
      voucherDate: voucher.voucherDate,
      totalDebit: amount(voucher.totalDebit),
      totalCredit: amount(voucher.totalCredit),
      difference: amount(voucher.totalDebit) - amount(voucher.totalCredit),
      lineCount: voucher._count.lines,
      sourceType: voucher.sourceType ?? "",
      sourceId: voucher.sourceId ?? "",
      narration: voucher.narration ?? "",
    })) };
  });
}

export const getVoucherListingReport = getTransactionsListingReport;
export const getVoucherListingReportCsv = getTransactionsListingReportCsv;

export async function getTransactionsListingReportCsv(context: Context, input: AccountingReportFilters = {}) {
  const report = await getTransactionsListingReport(context, input);
  return toCsv(["Voucher No", "Date", "Type", "Debit", "Credit", "Difference", "Lines", "Source Type", "Source ID", "Narration"], report.rows.map((row) => [row.voucherNo, row.voucherDate.toISOString().slice(0, 10), row.voucherType, row.totalDebit, row.totalCredit, row.difference, row.lineCount, row.sourceType, row.sourceId, row.narration]));
}

export async function getMultipleLedgerReport(context: Context, input: AccountingReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const ids = (input.accountIds ?? input.accountId ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length) throw new Error("accountIds is required.");
    const accounts = await tx.chartAccount.findMany({ where: { companyId: context.companyId, id: { in: ids } }, select: { id: true, code: true, name: true, normalBalance: true } });
    if (accounts.length !== ids.length) throw new Error("accountIds contains an invalid chart account.");
    const filters = parseReportFilters(input);
    const lines = await tx.accountingVoucherLine.findMany({
      where: { accountId: { in: ids }, voucher: { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true, voucherDate: voucherDateWhere(filters) } },
      orderBy: [{ voucher: { voucherDate: "asc" } }, { voucher: { createdAt: "asc" } }, { sortOrder: "asc" }],
      take: 10000,
      select: { id: true, accountId: true, debit: true, credit: true, description: true, voucher: { select: { voucherNo: true, voucherType: true, voucherDate: true, sourceType: true, sourceId: true, narration: true } }, account: { select: { code: true, name: true, normalBalance: true } } },
    });
    const running = new Map(accounts.map((account) => [account.id, 0]));
    const rows = lines.map((line) => {
      const debit = amount(line.debit); const credit = amount(line.credit);
      const balance = (running.get(line.accountId) ?? 0) + signedBalance(line.account.normalBalance, debit, credit);
      running.set(line.accountId, balance);
      return { id: line.id, accountId: line.accountId, accountCode: line.account.code, accountName: line.account.name, voucherNo: line.voucher.voucherNo, voucherType: line.voucher.voucherType, transactionDate: line.voucher.voucherDate, debit, credit, runningBalance: balance, sourceType: line.voucher.sourceType ?? "", sourceId: line.voucher.sourceId ?? "", description: line.description ?? line.voucher.narration ?? "" };
    });
    return { rows };
  });
}

export const getCombineLedgerReport = getMultipleLedgerReport;

export async function getMultipleLedgerReportCsv(context: Context, input: AccountingReportFilters = {}) {
  const report = await getMultipleLedgerReport(context, input);
  return toCsv(["Account Code", "Account Name", "Date", "Voucher", "Type", "Debit", "Credit", "Running Balance", "Source", "Narration"], report.rows.map((row) => [row.accountCode, row.accountName, row.transactionDate.toISOString().slice(0, 10), row.voucherNo, row.voucherType, row.debit, row.credit, row.runningBalance, row.sourceId, row.description]));
}

export async function getExecutiveSummaryReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const where = { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true, voucherDate: voucherDateWhere(filters) };
    const grouped = await tx.accountingVoucherLine.groupBy({ by: ["accountId"], where: { voucher: where }, _sum: { debit: true, credit: true } });
    const [accounts, customers, vendors] = await Promise.all([
      tx.chartAccount.findMany({ where: { companyId: context.companyId, id: { in: grouped.map((row) => row.accountId) } }, select: { id: true, name: true, accountType: true, normalBalance: true } }),
      tx.customer.findMany({ where: { companyId: context.companyId }, select: { accountId: true } }),
      tx.vendor.findMany({ where: { companyId: context.companyId }, select: { accountId: true } }),
    ]);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const totals = { assets: 0, liabilities: 0, equity: 0, revenue: 0, expenses: 0, cashAndBank: 0 };
    for (const row of grouped) { const account = byId.get(row.accountId); if (!account) continue; const debit = amount(row._sum.debit); const credit = amount(row._sum.credit); const value = signedBalance(account.normalBalance, debit, credit); if (account.accountType === "ASSET") totals.assets += value; if (account.accountType === "LIABILITY") totals.liabilities += value; if (account.accountType === "EQUITY") totals.equity += value; if (account.accountType === "REVENUE") totals.revenue += credit - debit; if (account.accountType === "EXPENSE") totals.expenses += debit - credit; if (account.accountType === "ASSET" && /cash|bank/i.test(account.name)) totals.cashAndBank += value; }
    const accountBalance = (accountIds: string[]) => accountIds.reduce((sum, accountId) => { const account = byId.get(accountId); const row = grouped.find((item) => item.accountId === accountId); return sum + (account ? signedBalance(account.normalBalance, amount(row?._sum.debit), amount(row?._sum.credit)) : 0); }, 0);
    return { totals: { ...totals, netProfit: totals.revenue - totals.expenses, receivables: accountBalance(customers.map((row) => row.accountId)), payables: accountBalance(vendors.map((row) => row.accountId)) }, rows: accounts.map((account) => { const row = grouped.find((item) => item.accountId === account.id); const debit = amount(row?._sum.debit); const credit = amount(row?._sum.credit); return { id: account.id, accountName: account.name, accountType: account.accountType, debit, credit, balance: signedBalance(account.normalBalance, debit, credit) }; }) };
  });
}

export async function getExecutiveSummaryReportCsv(context: Context, input: ReportFilters = {}) {
  const report = await getExecutiveSummaryReport(context, input);
  return toCsv(["Metric", "Amount"], Object.entries(report.totals).map(([key, value]) => [key, value]));
}

export async function getReportUsers(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    return tx.user.findMany({ where: { companyId: context.companyId, status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, loginId: true } });
  });
}
