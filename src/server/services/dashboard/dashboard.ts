import { AccountType, CylinderState, PermissionAction, StockDirection, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = Prisma.TransactionClient;
type Context = { companyId: string; financialYearId: string; userId: string };

function n(value: unknown): number {
  return Number(value ?? 0);
}

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function monthStartUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function computeKpis(tx: Tx, context: Context, today: Date, monthStart: Date) {
  const vBase = { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true };
  const cashFilter = { companyId: context.companyId, accountType: AccountType.ASSET, name: { contains: "Cash", mode: "insensitive" as const } };

  const [customers, vendors] = await Promise.all([
    tx.customer.findMany({ where: { companyId: context.companyId }, select: { accountId: true } }),
    tx.vendor.findMany({ where: { companyId: context.companyId }, select: { accountId: true } }),
  ]);
  const customerAccIds = customers.map((c) => c.accountId);
  const vendorAccIds = vendors.map((v) => v.accountId);

  const empty = { _sum: { debit: 0 as unknown as null, credit: 0 as unknown as null } };

  const [cashPos, todayCash, todaySale, receivables, payables, expenses, mExpenses] = await Promise.all([
    tx.accountingVoucherLine.aggregate({ where: { account: cashFilter, voucher: vBase }, _sum: { debit: true, credit: true } }),
    tx.accountingVoucherLine.aggregate({ where: { account: cashFilter, voucher: { ...vBase, voucherDate: { gte: today, lte: today } } }, _sum: { debit: true, credit: true } }),
    tx.accountingVoucherLine.aggregate({ where: { account: { companyId: context.companyId, accountType: AccountType.REVENUE }, voucher: { ...vBase, voucherDate: { gte: today, lte: today } } }, _sum: { credit: true } }),
    customerAccIds.length > 0
      ? tx.accountingVoucherLine.aggregate({ where: { accountId: { in: customerAccIds }, voucher: vBase }, _sum: { debit: true, credit: true } })
      : Promise.resolve(empty),
    vendorAccIds.length > 0
      ? tx.accountingVoucherLine.aggregate({ where: { accountId: { in: vendorAccIds }, voucher: vBase }, _sum: { debit: true, credit: true } })
      : Promise.resolve(empty),
    tx.accountingVoucherLine.aggregate({ where: { account: { companyId: context.companyId, accountType: AccountType.EXPENSE }, voucher: vBase }, _sum: { debit: true, credit: true } }),
    tx.accountingVoucherLine.aggregate({ where: { account: { companyId: context.companyId, accountType: AccountType.EXPENSE }, voucher: { ...vBase, voucherDate: { gte: monthStart } } }, _sum: { debit: true, credit: true } }),
  ]);

  return {
    todayCash: n(todayCash._sum.debit) - n(todayCash._sum.credit),
    cashPosition: n(cashPos._sum.debit) - n(cashPos._sum.credit),
    receivables: n(receivables._sum.debit) - n(receivables._sum.credit),
    payables: n(payables._sum.credit) - n(payables._sum.debit),
    todaySale: n(todaySale._sum.credit),
    expenses: n(expenses._sum.debit) - n(expenses._sum.credit),
    mExpenses: n(mExpenses._sum.debit) - n(mExpenses._sum.credit),
  };
}

async function computeBankPosition(tx: Tx, context: Context) {
  const vBase = { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true };
  const banks = await tx.bank.findMany({
    where: { companyId: context.companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, accountId: true, account: { select: { code: true, name: true } } },
  });
  return Promise.all(
    banks.map(async (bank) => {
      const agg = await tx.accountingVoucherLine.aggregate({
        where: { accountId: bank.accountId, voucher: vBase },
        _sum: { debit: true, credit: true },
      });
      const totalDebit = n(agg._sum.debit);
      const totalCredit = n(agg._sum.credit);
      return { id: bank.id, name: bank.name, accountCode: bank.account.code, totalDebit, totalCredit, balance: totalDebit - totalCredit };
    }),
  );
}

async function computeCurrentStock(tx: Tx, context: Context) {
  const rows = await tx.stockLedgerEntry.groupBy({
    by: ["itemId", "cylinderState", "direction"],
    where: { companyId: context.companyId, financialYearId: context.financialYearId },
    _sum: { quantity: true },
  });
  if (rows.length === 0) return [];

  const items = await tx.item.findMany({
    where: { companyId: context.companyId, id: { in: [...new Set(rows.map((r) => r.itemId))] } },
    select: { id: true, code: true, name: true },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const byItem = new Map<string, { id: string; itemCode: string; itemName: string; filled: number; empty: number }>();
  for (const row of rows) {
    const item = itemById.get(row.itemId);
    const current = byItem.get(row.itemId) ?? { id: row.itemId, itemCode: item?.code ?? "", itemName: item?.name ?? "", filled: 0, empty: 0 };
    const signed = (row.direction === StockDirection.IN ? 1 : -1) * (row._sum.quantity ?? 0);
    if (row.cylinderState === CylinderState.FILLED) current.filled += signed;
    else current.empty += signed;
    byItem.set(row.itemId, current);
  }

  return [...byItem.values()].sort((a, b) => a.itemCode.localeCompare(b.itemCode));
}

async function computeSaleStats(tx: Tx, context: Context, today: Date, monthStart: Date) {
  const vBase = { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true };
  const revenueFilter = { companyId: context.companyId, accountType: AccountType.REVENUE };
  const [todayAgg, monthAgg] = await Promise.all([
    tx.accountingVoucherLine.aggregate({
      where: { account: revenueFilter, voucher: { ...vBase, voucherDate: { gte: today, lte: today } } },
      _sum: { credit: true },
      _count: { id: true },
    }),
    tx.accountingVoucherLine.aggregate({
      where: { account: revenueFilter, voucher: { ...vBase, voucherDate: { gte: monthStart } } },
      _sum: { credit: true },
      _count: { id: true },
    }),
  ]);
  return {
    today: { count: todayAgg._count.id, amount: n(todayAgg._sum.credit) },
    month: { count: monthAgg._count.id, amount: n(monthAgg._sum.credit) },
  };
}

export async function getDashboardData(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const today = todayUtc();
    const monthStart = monthStartUtc();
    const [kpis, bankPosition, currentStock, saleStats] = await Promise.all([
      computeKpis(tx, context, today, monthStart),
      computeBankPosition(tx, context),
      computeCurrentStock(tx, context),
      computeSaleStats(tx, context, today, monthStart),
    ]);
    return { kpis, bankPosition, currentStock, saleStats };
  });
}
