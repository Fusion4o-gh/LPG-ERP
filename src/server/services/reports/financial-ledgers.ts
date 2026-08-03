import { AccountType, NormalBalance, PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { parseReportFilters, type ReportFilters } from "./operational-reports.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type LedgerFilters = ReportFilters & { vendorId?: string; accountId?: string; bankId?: string; accountType?: string; asOf?: string };
export type ProfitLossFilters = ReportFilters & { breakdown?: string };

type ProfitLossRow = {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  amount: number;
  monthlyAmounts?: Record<string, number>;
};

function monthKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 7);
}

function lineAmount(accountType: AccountType, debit: number, credit: number) {
  return accountType === AccountType.REVENUE ? credit - debit : debit - credit;
}

function buildProfitLossRows(
  grouped: Array<{ accountId: string; _sum: { debit: Prisma.Decimal | null; credit: Prisma.Decimal | null } }>,
  accountById: Map<string, { id: string; code: string; name: string; accountType: AccountType }>,
) {
  return grouped
    .map((row) => {
      const account = accountById.get(row.accountId);
      const debit = amount(row._sum.debit);
      const credit = amount(row._sum.credit);
      const accountType = account?.accountType ?? AccountType.EXPENSE;
      return {
        id: row.accountId,
        accountCode: account?.code ?? "",
        accountName: account?.name ?? "",
        accountType,
        debit,
        credit,
        amount: lineAmount(accountType, debit, credit),
      };
    })
    .sort((a, b) => `${a.accountType}-${a.accountCode}`.localeCompare(`${b.accountType}-${b.accountCode}`));
}

async function loadProfitLossMonthly(
  tx: Prisma.TransactionClient,
  context: Context,
  filters: ReturnType<typeof parseReportFilters>,
) {
  const lines = await tx.accountingVoucherLine.findMany({
    where: {
      voucher: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        isPosted: true,
        voucherDate: voucherDateWhere(filters),
      },
      account: {
        companyId: context.companyId,
        accountType: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
      },
    },
    select: {
      accountId: true,
      debit: true,
      credit: true,
      voucher: { select: { voucherDate: true } },
      account: { select: { id: true, code: true, name: true, accountType: true } },
    },
  });

  const monthSet = new Set<string>();
  const byAccountMonth = new Map<string, Map<string, number>>();
  const accountMeta = new Map<string, { id: string; code: string; name: string; accountType: AccountType }>();

  for (const line of lines) {
    const key = monthKey(line.voucher.voucherDate);
    if (!key) continue;
    monthSet.add(key);
    accountMeta.set(line.accountId, line.account);
    const debit = amount(line.debit);
    const credit = amount(line.credit);
    const value = lineAmount(line.account.accountType, debit, credit);
    const accountMonths = byAccountMonth.get(line.accountId) ?? new Map<string, number>();
    accountMonths.set(key, (accountMonths.get(key) ?? 0) + value);
    byAccountMonth.set(line.accountId, accountMonths);
  }

  const months = [...monthSet].sort();
  const rows: ProfitLossRow[] = [...byAccountMonth.entries()].map(([accountId, monthlyMap]) => {
    const account = accountMeta.get(accountId)!;
    const monthlyAmounts = Object.fromEntries(months.map((month) => [month, monthlyMap.get(month) ?? 0]));
    const amountTotal = months.reduce((sum, month) => sum + (monthlyMap.get(month) ?? 0), 0);
    return {
      id: accountId,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.accountType,
      debit: 0,
      credit: 0,
      amount: amountTotal,
      monthlyAmounts,
    };
  });

  return { months, rows: rows.sort((a, b) => `${a.accountType}-${a.accountCode}`.localeCompare(`${b.accountType}-${b.accountCode}`)) };
}

function monthlyTotals(rows: ProfitLossRow[], months: string[], accountType: AccountType) {
  const filtered = rows.filter((row) => row.accountType === accountType);
  const totals: Record<string, number> = {};
  for (const month of months) {
    totals[month] = filtered.reduce((sum, row) => sum + (row.monthlyAmounts?.[month] ?? 0), 0);
  }
  return totals;
}

function yearlyProfitLoss(monthly: Awaited<ReturnType<typeof loadProfitLossMonthly>>) {
  const years = [...new Set(monthly.months.map((month) => month.slice(0, 4)))].sort();
  const rows = monthly.rows.map((row) => {
    const yearlyAmounts = Object.fromEntries(
      years.map((year) => [year, monthly.months.filter((month) => month.startsWith(`${year}-`)).reduce((total, month) => total + (row.monthlyAmounts?.[month] ?? 0), 0)]),
    );
    return { ...row, amount: years.reduce((total, year) => total + (yearlyAmounts[year] ?? 0), 0), monthlyAmounts: yearlyAmounts };
  });
  return { months: years, rows };
}
type AccountRef = { id: string; code: string; name: string; normalBalance: NormalBalance };
type LedgerRow = {
  id: string;
  transactionDate: Date | null;
  account: AccountRef;
  voucherNo: string;
  voucherType: string;
  debit: number;
  credit: number;
  runningBalance: number;
  sourceType: string;
  sourceId: string;
  description: string;
};

function amount(value: unknown) {
  return Number(value ?? 0);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(2);
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function signedAmount(account: AccountRef, debit: unknown, credit: unknown) {
  const debitValue = amount(debit);
  const creditValue = amount(credit);
  return account.normalBalance === NormalBalance.CREDIT ? creditValue - debitValue : debitValue - creditValue;
}

function voucherDateWhere(filters: ReturnType<typeof parseReportFilters>) {
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

function parseAccountType(value?: string) {
  if (!value) return undefined;
  if (!Object.values(AccountType).includes(value as AccountType)) throw new Error("accountType must be a valid account type.");
  return value as AccountType;
}

async function accountLedger(tx: Prisma.TransactionClient, context: Context, account: AccountRef, input: ReportFilters = {}) {
  const filters = parseReportFilters(input);
  const voucherBase: Prisma.AccountingVoucherWhereInput = {
    companyId: context.companyId,
    financialYearId: context.financialYearId,
    isPosted: true,
  };
  const baseWhere: Prisma.AccountingVoucherLineWhereInput = {
    accountId: account.id,
    voucher: voucherBase,
  };

  const openingLines = filters.from
    ? await tx.accountingVoucherLine.findMany({
        where: { ...baseWhere, voucher: { ...voucherBase, voucherDate: { lt: filters.from } } },
        select: { debit: true, credit: true },
      })
    : [];
  const openingBalance = openingLines.reduce((total, line) => total + signedAmount(account, line.debit, line.credit), 0);

  const lines = await tx.accountingVoucherLine.findMany({
    where: { ...baseWhere, voucher: { ...voucherBase, voucherDate: voucherDateWhere(filters) } },
    include: {
      voucher: {
        select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, sourceType: true, sourceId: true, narration: true, createdAt: true },
      },
    },
    orderBy: [{ voucher: { voucherDate: "asc" } }, { voucher: { createdAt: "asc" } }, { sortOrder: "asc" }],
    take: 500,
  });

  let runningBalance = openingBalance;
  const rows: LedgerRow[] = [
    {
      id: `${account.id}-opening`,
      transactionDate: null,
      account,
      voucherNo: "Opening Balance",
      voucherType: "",
      debit: 0,
      credit: 0,
      runningBalance,
      sourceType: "",
      sourceId: "",
      description: "",
    },
  ];

  for (const line of lines) {
    const debit = amount(line.debit);
    const credit = amount(line.credit);
    runningBalance += signedAmount(account, debit, credit);
    rows.push({
      id: line.id,
      transactionDate: line.voucher.voucherDate,
      account,
      voucherNo: line.voucher.voucherNo,
      voucherType: line.voucher.voucherType,
      debit,
      credit,
      runningBalance,
      sourceType: line.voucher.sourceType ?? "",
      sourceId: line.voucher.sourceId ?? "",
      description: line.description ?? line.voucher.narration ?? "",
    });
  }

  return { account, openingBalance, rows };
}

export async function getCustomerLedgerReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const customer = await tx.customer.findFirst({
      where: { id: input.customerId, companyId: context.companyId },
      include: { account: { select: { id: true, code: true, name: true, normalBalance: true } } },
    });
    if (!customer) throw new Error("customerId must reference a valid customer.");
    return accountLedger(tx, context, customer.account, input);
  });
}

export async function getVendorLedgerReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const vendor = await tx.vendor.findFirst({
      where: { id: input.vendorId, companyId: context.companyId },
      include: { account: { select: { id: true, code: true, name: true, normalBalance: true } } },
    });
    if (!vendor) throw new Error("vendorId must reference a valid vendor.");
    return accountLedger(tx, context, vendor.account, input);
  });
}

export async function getCashBookReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const bankAccounts = await tx.bank.findMany({ where: { companyId: context.companyId }, select: { accountId: true } });
    const cashOrBank: Prisma.ChartAccountWhereInput[] = [{ name: { contains: "Cash" } }, { id: { in: bankAccounts.map((bank) => bank.accountId) } }];
    const account = await tx.chartAccount.findFirst({
      where: {
        companyId: context.companyId,
        id: input.accountId,
        OR: cashOrBank,
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, normalBalance: true },
    });
    if (!account) throw new Error("accountId must reference a valid cash or bank account.");
    return accountLedger(tx, context, account, input);
  });
}

export async function getTrialBalanceReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const accountType = parseAccountType(input.accountType);
    const grouped = await tx.accountingVoucherLine.groupBy({
      by: ["accountId"],
      where: {
        voucher: {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          isPosted: true,
          voucherDate: voucherDateWhere(filters),
        },
        account: {
          companyId: context.companyId,
          accountType,
        },
      },
      _sum: { debit: true, credit: true },
      orderBy: { accountId: "asc" },
    });
    const accounts = await tx.chartAccount.findMany({
      where: { companyId: context.companyId, id: { in: grouped.map((row) => row.accountId) } },
      select: { id: true, code: true, name: true, accountType: true },
    });
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const rows = grouped
      .map((row) => {
        const totalDebit = amount(row._sum.debit);
        const totalCredit = amount(row._sum.credit);
        const net = totalDebit - totalCredit;
        const account = accountById.get(row.accountId);
        return {
          id: row.accountId,
          accountCode: account?.code ?? "",
          accountName: account?.name ?? "",
          accountType: account?.accountType ?? "",
          totalDebit,
          totalCredit,
          netDebit: net > 0 ? net : 0,
          netCredit: net < 0 ? Math.abs(net) : 0,
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const totalDebit = rows.reduce((total, row) => total + row.totalDebit, 0);
    const totalCredit = rows.reduce((total, row) => total + row.totalCredit, 0);
    const balanceDifference = totalDebit - totalCredit;
    return { rows, totalDebit, totalCredit, balanceDifference, isBalanced: Math.abs(balanceDifference) < 0.005 };
  });
}

export async function getProfitLossReport(context: Context, input: ProfitLossFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const breakdown = String(input.breakdown ?? "").toLowerCase();
    const useMonthly = breakdown === "month";
    const useYearly = breakdown === "year";

    let rows: ProfitLossRow[];
    let months: string[] | undefined;
    let monthlyTotalsBlock: { revenue: Record<string, number>; expenses: Record<string, number>; net: Record<string, number> } | undefined;

    if (useMonthly || useYearly) {
      const monthly = await loadProfitLossMonthly(tx, context, filters);
      const periodic = useYearly ? yearlyProfitLoss(monthly) : monthly;
      rows = periodic.rows;
      const monthKeys = periodic.months;
      months = monthKeys;
      monthlyTotalsBlock = {
        revenue: monthlyTotals(rows, monthKeys, AccountType.REVENUE),
        expenses: monthlyTotals(rows, monthKeys, AccountType.EXPENSE),
        net: Object.fromEntries(
          monthKeys.map((month) => [
            month,
            (monthlyTotals(rows, monthKeys, AccountType.REVENUE)[month] ?? 0) - (monthlyTotals(rows, monthKeys, AccountType.EXPENSE)[month] ?? 0),
          ]),
        ),
      };
    } else {
      const grouped = await tx.accountingVoucherLine.groupBy({
        by: ["accountId"],
        where: {
          voucher: {
            companyId: context.companyId,
            financialYearId: context.financialYearId,
            isPosted: true,
            voucherDate: voucherDateWhere(filters),
          },
          account: {
            companyId: context.companyId,
            accountType: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
          },
        },
        _sum: { debit: true, credit: true },
        orderBy: { accountId: "asc" },
      });
      const accounts = await tx.chartAccount.findMany({
        where: { companyId: context.companyId, id: { in: grouped.map((row) => row.accountId) } },
        select: { id: true, code: true, name: true, accountType: true },
      });
      const accountById = new Map(accounts.map((account) => [account.id, account]));
      rows = buildProfitLossRows(grouped, accountById);
    }

    const revenueRows = rows.filter((row) => row.accountType === AccountType.REVENUE);
    const expenseRows = rows.filter((row) => row.accountType === AccountType.EXPENSE);
    const totalRevenue = revenueRows.reduce((total, row) => total + row.amount, 0);
    const totalExpenses = expenseRows.reduce((total, row) => total + row.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      revenueRows,
      expenseRows,
      rows,
      months,
      monthlyTotals: monthlyTotalsBlock,
      totalRevenue,
      totalExpenses,
      netProfit,
      netLoss: netProfit < 0 ? Math.abs(netProfit) : 0,
      result: netProfit >= 0 ? "Profit" : "Loss",
    };
  });
}

export async function getBalanceSheetReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters({ to: input.asOf ?? input.to });
    const grouped = await tx.accountingVoucherLine.groupBy({
      by: ["accountId"],
      where: {
        voucher: {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          isPosted: true,
          voucherDate: voucherDateWhere(filters),
        },
        account: {
          companyId: context.companyId,
          accountType: { in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY] },
        },
      },
      _sum: { debit: true, credit: true },
      orderBy: { accountId: "asc" },
    });
    const accounts = await tx.chartAccount.findMany({
      where: { companyId: context.companyId, id: { in: grouped.map((row) => row.accountId) } },
      select: { id: true, code: true, name: true, accountType: true, normalBalance: true },
    });
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const rows = grouped
      .map((row) => {
        const account = accountById.get(row.accountId);
        const debit = amount(row._sum.debit);
        const credit = amount(row._sum.credit);
        const balance = account?.normalBalance === NormalBalance.CREDIT ? credit - debit : debit - credit;
        return {
          id: row.accountId,
          accountCode: account?.code ?? "",
          accountName: account?.name ?? "",
          accountType: account?.accountType ?? "",
          debit,
          credit,
          balance,
        };
      })
      .sort((a, b) => `${a.accountType}-${a.accountCode}`.localeCompare(`${b.accountType}-${b.accountCode}`));
    const assetRows = rows.filter((row) => row.accountType === AccountType.ASSET);
    const liabilityRows = rows.filter((row) => row.accountType === AccountType.LIABILITY);
    const equityRows = rows.filter((row) => row.accountType === AccountType.EQUITY);
    const totalAssets = assetRows.reduce((total, row) => total + row.balance, 0);
    const totalLiabilities = liabilityRows.reduce((total, row) => total + row.balance, 0);
    const totalEquity = equityRows.reduce((total, row) => total + row.balance, 0);
    const balanceDifference = totalAssets - (totalLiabilities + totalEquity);

    return {
      assetRows,
      liabilityRows,
      equityRows,
      rows,
      totalAssets,
      totalLiabilities,
      totalEquity,
      balanceDifference,
      isBalanced: Math.abs(balanceDifference) < 0.005,
    };
  });
}

function ledgerRowsCsv(rows: LedgerRow[]) {
  return toCsv(
    ["Date", "Voucher / Opening", "Source Document", "Narration", "Debit", "Credit", "Running Balance"],
    rows.map((row) => [
      formatDate(row.transactionDate),
      row.voucherNo,
      row.sourceId,
      row.description,
      formatMoney(row.debit),
      formatMoney(row.credit),
      formatMoney(row.runningBalance),
    ]),
  );
}

export async function getCustomerLedgerReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getCustomerLedgerReport(context, input);
  return ledgerRowsCsv(report.rows);
}

export async function getVendorLedgerReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getVendorLedgerReport(context, input);
  return ledgerRowsCsv(report.rows);
}

export async function getCashBookReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getCashBookReport(context, input);
  return ledgerRowsCsv(report.rows);
}

export async function getTrialBalanceReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getTrialBalanceReport(context, input);
  return toCsv(
    ["Account Code", "Account Name", "Type", "Total Debit", "Total Credit", "Net Debit", "Net Credit"],
    report.rows.map((row) => [
      row.accountCode,
      row.accountName,
      row.accountType,
      formatMoney(row.totalDebit),
      formatMoney(row.totalCredit),
      formatMoney(row.netDebit),
      formatMoney(row.netCredit),
    ]),
  );
}

export async function getProfitLossReportCsv(context: Context, input: ProfitLossFilters = {}) {
  const report = await getProfitLossReport(context, input);
  if (report.months?.length) {
    const headers = ["Section", "Account Code", "Account Name", ...report.months, "Period Total"];
    const revenueLines = report.revenueRows.map((row) => [
      "Revenue",
      row.accountCode,
      row.accountName,
      ...report.months!.map((month) => formatMoney(row.monthlyAmounts?.[month])),
      formatMoney(row.amount),
    ]);
    const expenseLines = report.expenseRows.map((row) => [
      "Expenses",
      row.accountCode,
      row.accountName,
      ...report.months!.map((month) => formatMoney(row.monthlyAmounts?.[month])),
      formatMoney(row.amount),
    ]);
    return toCsv(headers, [
      ...revenueLines,
      ["Revenue", "", "Total Revenue", ...report.months.map((month) => formatMoney(report.monthlyTotals?.revenue[month])), formatMoney(report.totalRevenue)],
      ...expenseLines,
      ["Expenses", "", "Total Expenses", ...report.months.map((month) => formatMoney(report.monthlyTotals?.expenses[month])), formatMoney(report.totalExpenses)],
      [report.result, "", `Net ${report.result}`, ...report.months.map((month) => formatMoney(report.monthlyTotals?.net[month])), formatMoney(report.netProfit)],
    ]);
  }
  return toCsv(
    ["Section", "Account Code", "Account Name", "Amount"],
    [
      ...report.revenueRows.map((row) => ["Revenue", row.accountCode, row.accountName, formatMoney(row.amount)]),
      ["Revenue", "", "Total Revenue", formatMoney(report.totalRevenue)],
      ...report.expenseRows.map((row) => ["Expenses", row.accountCode, row.accountName, formatMoney(row.amount)]),
      ["Expenses", "", "Total Expenses", formatMoney(report.totalExpenses)],
      [report.result, "", `Net ${report.result}`, formatMoney(report.netProfit >= 0 ? report.netProfit : -report.netLoss)],
    ],
  );
}

export async function getBankBookReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    if (!input.bankId) throw new Error("bankId is required.");
    const bank = await tx.bank.findFirst({
      where: { id: input.bankId, companyId: context.companyId },
      select: { id: true, name: true, account: { select: { id: true, code: true, name: true, normalBalance: true } } },
    });
    if (!bank) throw new Error("bankId must reference a valid bank account.");
    return accountLedger(tx, context, bank.account, input);
  });
}

export async function getBankBookReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getBankBookReport(context, input);
  return ledgerRowsCsv(report.rows);
}

export async function getGeneralLedgerReport(context: Context, input: LedgerFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    if (!input.accountId) throw new Error("accountId is required.");
    const account = await tx.chartAccount.findFirst({
      where: { id: input.accountId, companyId: context.companyId },
      select: { id: true, code: true, name: true, normalBalance: true },
    });
    if (!account) throw new Error("accountId must reference a valid chart account.");
    return accountLedger(tx, context, account, input);
  });
}

export async function getGeneralLedgerReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getGeneralLedgerReport(context, input);
  return ledgerRowsCsv(report.rows);
}

type AgeingInput = { asOf?: string; to?: string };
type AgeingParty = { id: string; code: string; name: string; creditDays: number; accountId: string };
type AgeingRow = AgeingParty & {
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90: number;
  outstanding: number;
  creditBalance: number;
  lastTransactionDate: Date | null;
};
type AgeingEntry = { date: Date; amount: number; dueDate: Date; kind: "charge" | "credit" };

function utcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function ageingBucket(asOf: Date, dueDate: Date) {
  const daysOverdue = Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / 86_400_000));
  if (daysOverdue === 0) return "current" as const;
  if (daysOverdue <= 30) return "days1To30" as const;
  if (daysOverdue <= 60) return "days31To60" as const;
  if (daysOverdue <= 90) return "days61To90" as const;
  return "over90" as const;
}

function allocateAgeingEntries(asOf: Date, entries: AgeingEntry[], party: AgeingParty): AgeingRow {
  const charges: Array<AgeingEntry & { remaining: number }> = [];
  let unappliedCredit = 0;
  for (const entry of entries.sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (entry.kind === "charge") {
      const applied = Math.min(unappliedCredit, entry.amount);
      unappliedCredit -= applied;
      charges.push({ ...entry, remaining: entry.amount - applied });
      continue;
    }
    let remainingCredit = entry.amount;
    for (const charge of charges) {
      if (remainingCredit <= 0) break;
      const applied = Math.min(charge.remaining, remainingCredit);
      charge.remaining -= applied;
      remainingCredit -= applied;
    }
    unappliedCredit += remainingCredit;
  }

  const row: AgeingRow = {
    ...party,
    current: 0,
    days1To30: 0,
    days31To60: 0,
    days61To90: 0,
    over90: 0,
    outstanding: 0,
    creditBalance: unappliedCredit,
    lastTransactionDate: entries.length ? entries[entries.length - 1].date : null,
  };
  for (const charge of charges) {
    if (charge.remaining <= 0.005) continue;
    row[ageingBucket(asOf, charge.dueDate)] += charge.remaining;
    row.outstanding += charge.remaining;
  }
  return row;
}

async function getAgeingReport(context: Context, input: AgeingInput, partyType: "customer" | "vendor") {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const parsed = parseReportFilters({ to: input.asOf ?? input.to });
    const asOf = parsed.to ?? utcDate(new Date());
    const parties = (partyType === "customer"
      ? await tx.customer.findMany({ where: { companyId: context.companyId }, select: { id: true, code: true, name: true, creditDays: true, accountId: true } })
      : await tx.vendor.findMany({ where: { companyId: context.companyId }, select: { id: true, code: true, name: true, creditDays: true, accountId: true } })) as AgeingParty[];
    const accountIds = parties.map((party) => party.accountId);
    if (!accountIds.length) return { asOf, rows: [], totals: { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0, outstanding: 0, creditBalance: 0 } };

    const lines = await tx.accountingVoucherLine.findMany({
      where: {
        accountId: { in: accountIds },
        voucher: {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          isPosted: true,
          voucherDate: { lte: asOf },
        },
      },
      select: { accountId: true, debit: true, credit: true, voucher: { select: { voucherDate: true, createdAt: true } } },
      orderBy: [{ voucher: { voucherDate: "asc" } }, { voucher: { createdAt: "asc" } }],
    });
    const partyByAccount = new Map(parties.map((party) => [party.accountId, party]));
    const entriesByAccount = new Map<string, AgeingEntry[]>();
    for (const line of lines) {
      const party = partyByAccount.get(line.accountId);
      if (!party) continue;
      const debit = amount(line.debit);
      const credit = amount(line.credit);
      const chargeAmount = partyType === "customer" ? debit : credit;
      const creditAmount = partyType === "customer" ? credit : debit;
      const date = utcDate(line.voucher.voucherDate);
      const entries = entriesByAccount.get(line.accountId) ?? [];
      if (chargeAmount > 0) entries.push({ date, amount: chargeAmount, dueDate: addDays(date, party.creditDays ?? 0), kind: "charge" });
      if (creditAmount > 0) entries.push({ date, amount: creditAmount, dueDate: date, kind: "credit" });
      entriesByAccount.set(line.accountId, entries);
    }

    const rows = parties
      .map((party) => allocateAgeingEntries(asOf, entriesByAccount.get(party.accountId) ?? [], { ...party, creditDays: party.creditDays ?? 0 }))
      .filter((row) => row.outstanding > 0.005 || row.creditBalance > 0.005)
      .sort((a, b) => `${a.name}-${a.code}`.localeCompare(`${b.name}-${b.code}`));
    const totals = rows.reduce(
      (total, row) => ({
        current: total.current + row.current,
        days1To30: total.days1To30 + row.days1To30,
        days31To60: total.days31To60 + row.days31To60,
        days61To90: total.days61To90 + row.days61To90,
        over90: total.over90 + row.over90,
        outstanding: total.outstanding + row.outstanding,
        creditBalance: total.creditBalance + row.creditBalance,
      }),
      { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0, outstanding: 0, creditBalance: 0 },
    );
    return { asOf, rows, totals };
  });
}

export async function getDebtorsAgeingReport(context: Context, input: AgeingInput = {}) {
  return getAgeingReport(context, input, "customer");
}

export async function getCreditorsAgeingReport(context: Context, input: AgeingInput = {}) {
  return getAgeingReport(context, input, "vendor");
}

function ageingCsv(report: Awaited<ReturnType<typeof getAgeingReport>>) {
  return toCsv(
    ["Code", "Party", "Credit Days", "Current", "1-30", "31-60", "61-90", "Over 90", "Outstanding", "Credit Balance", "Last Transaction"],
    report.rows.map((row) => [
      row.code,
      row.name,
      row.creditDays,
      formatMoney(row.current),
      formatMoney(row.days1To30),
      formatMoney(row.days31To60),
      formatMoney(row.days61To90),
      formatMoney(row.over90),
      formatMoney(row.outstanding),
      formatMoney(row.creditBalance),
      formatDate(row.lastTransactionDate),
    ]),
  );
}

export async function getDebtorsAgeingReportCsv(context: Context, input: AgeingInput = {}) {
  return ageingCsv(await getDebtorsAgeingReport(context, input));
}

export async function getCreditorsAgeingReportCsv(context: Context, input: AgeingInput = {}) {
  return ageingCsv(await getCreditorsAgeingReport(context, input));
}

export async function getBalanceSheetReportCsv(context: Context, input: LedgerFilters = {}) {
  const report = await getBalanceSheetReport(context, input);
  return toCsv(
    ["Category", "Account Code", "Account Name", "Debit", "Credit", "Balance"],
    [
      ...report.rows.map((row) => [
        row.accountType,
        row.accountCode,
        row.accountName,
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.balance),
      ]),
      ["Total Assets", "", "", "", "", formatMoney(report.totalAssets)],
      ["Total Liabilities", "", "", "", "", formatMoney(report.totalLiabilities)],
      ["Total Equity", "", "", "", "", formatMoney(report.totalEquity)],
      ["Balance Difference", "", "", "", "", formatMoney(report.balanceDifference)],
    ],
  );
}
