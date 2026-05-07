import { AccountType, NormalBalance, PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { parseReportFilters, type ReportFilters } from "./operational-reports.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type LedgerFilters = ReportFilters & { vendorId?: string; accountId?: string; accountType?: string; asOf?: string };
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

    return { rows };
  });
}

export async function getProfitLossReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
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
    const rows = grouped
      .map((row) => {
        const account = accountById.get(row.accountId);
        const debit = amount(row._sum.debit);
        const credit = amount(row._sum.credit);
        const value = account?.accountType === AccountType.REVENUE ? credit - debit : debit - credit;
        return {
          id: row.accountId,
          accountCode: account?.code ?? "",
          accountName: account?.name ?? "",
          accountType: account?.accountType ?? "",
          debit,
          credit,
          amount: value,
        };
      })
      .sort((a, b) => `${a.accountType}-${a.accountCode}`.localeCompare(`${b.accountType}-${b.accountCode}`));
    const revenueRows = rows.filter((row) => row.accountType === AccountType.REVENUE);
    const expenseRows = rows.filter((row) => row.accountType === AccountType.EXPENSE);
    const totalRevenue = revenueRows.reduce((total, row) => total + row.amount, 0);
    const totalExpenses = expenseRows.reduce((total, row) => total + row.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      revenueRows,
      expenseRows,
      rows,
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

export async function getProfitLossReportCsv(context: Context, input: ReportFilters = {}) {
  const report = await getProfitLossReport(context, input);
  return toCsv(
    ["Category", "Account Code", "Account Name", "Debit", "Credit", "Amount"],
    [
      ...report.rows.map((row) => [
        row.accountType,
        row.accountCode,
        row.accountName,
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.amount),
      ]),
      ["Total Revenue", "", "", "", "", formatMoney(report.totalRevenue)],
      ["Total Expenses", "", "", "", "", formatMoney(report.totalExpenses)],
      [report.result, "", "", "", "", formatMoney(report.netProfit)],
    ],
  );
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
