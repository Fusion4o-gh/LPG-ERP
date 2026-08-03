import { AccountType, CylinderState, PermissionAction, Prisma, StockDirection } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { listBackupFiles } from "../backup/database-backup.ts";
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

function selectedMonthRangeUtc(month?: number, year?: number) {
  const now = new Date();
  const safeYear = Number.isInteger(year) && (year as number) >= 2000 && (year as number) <= 2100 ? year as number : now.getUTCFullYear();
  const safeMonth = Number.isInteger(month) && (month as number) >= 1 && (month as number) <= 12 ? month as number : now.getUTCMonth() + 1;
  return {
    year: safeYear,
    month: safeMonth,
    start: new Date(Date.UTC(safeYear, safeMonth - 1, 1)),
    end: new Date(Date.UTC(safeYear, safeMonth, 0)),
  };
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
      return {
        id: bank.id,
        accountId: bank.accountId,
        name: bank.name,
        accountCode: bank.account.code,
        totalDebit,
        totalCredit,
        balance: totalDebit - totalCredit,
      };
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

async function computeBulkStock(tx: Tx, context: Context) {
  const rows = await tx.bulkStockLedgerEntry.findMany({
    where: { companyId: context.companyId, financialYearId: context.financialYearId, inTransit: false },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    select: { productId: true, locationId: true, direction: true, quantity: true, unit: true, sourceType: true, sourceId: true, createdAt: true, transactionDate: true },
  });
  if (rows.length === 0) return [];

  const sourceIds = (sourceType: string) => [...new Set(rows.filter((row) => row.sourceType === sourceType).map((row) => row.sourceId))];
  const [products, locations, openings, localPurchases, loadings, receivingEvents, decantings, dollarTransactions, transfers, lossGains] = await Promise.all([
    tx.bulkProduct.findMany({
      where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.productId))] } },
      select: { id: true, code: true, name: true, unit: true },
    }),
    tx.stockLocation.findMany({
      where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.locationId))] } },
      select: { id: true, code: true, name: true },
    }),
    tx.bulkOpeningStock.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId, id: { in: [...new Set([...sourceIds("OPENING_STOCK"), ...sourceIds("ADJUSTMENT")])] } }, select: { id: true, valuationRate: true } }),
    tx.localPurchase.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId, id: { in: sourceIds("LOCAL_PURCHASE") } }, select: { id: true, rate: true } }),
    tx.loading.findMany({ where: { companyId: context.companyId, id: { in: sourceIds("IMPORT_ARRIVAL") } }, select: { id: true, finalRate: true } }),
    tx.partialReceivingEvent.findMany({ where: { id: { in: sourceIds("PARTIAL_RECEIVING") } }, select: { id: true, partialReceiving: { select: { finalRate: true } } } }),
    tx.plantDecanting.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId, id: { in: sourceIds("DECANTING") } }, select: { id: true, rate: true } }),
    tx.dollarTransaction.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId, id: { in: sourceIds("DOLLAR_SALE") } }, select: { id: true, txnType: true, pkrAmount: true, quantity: true } }),
    tx.plantTransfer.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId, id: { in: sourceIds("PLANT_TRANSFER") } }, select: { id: true } }),
    tx.lossGain.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId, id: { in: sourceIds("LOSS_GAIN") } }, select: { id: true, rate: true } }),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const openingRateById = new Map(openings.map((row) => [row.id, new Prisma.Decimal(row.valuationRate)]));
  const localRateById = new Map(localPurchases.map((row) => [row.id, new Prisma.Decimal(row.rate)]));
  const loadingRateById = new Map(loadings.map((row) => [row.id, new Prisma.Decimal(row.finalRate)]));
  const receivingRateById = new Map(receivingEvents.map((row) => [row.id, new Prisma.Decimal(row.partialReceiving.finalRate)]));
  const decantingRateById = new Map(decantings.map((row) => [row.id, new Prisma.Decimal(row.rate)]));
  const dollarRateById = new Map(dollarTransactions.map((row) => [row.id, row.quantity && !new Prisma.Decimal(row.quantity).isZero() ? new Prisma.Decimal(row.pkrAmount).div(row.quantity) : null]));
  const lossGainRateById = new Map(lossGains.map((row) => [row.id, new Prisma.Decimal(row.rate)]));
  const transferRateById = new Map<string, Prisma.Decimal>();
  const byKey = new Map<string, { id: string; productCode: string; productName: string; locationCode: string; locationName: string; quantity: Prisma.Decimal; value: Prisma.Decimal; valuationKnown: boolean; unit: string }>();

  for (const row of rows) {
    const product = productById.get(row.productId);
    const location = locationById.get(row.locationId);
    const key = `${row.productId}:${row.locationId}`;
    const current = byKey.get(key) ?? {
      id: key,
      productCode: product?.code ?? "",
      productName: product?.name ?? "",
      locationCode: location?.code ?? "",
      locationName: location?.name ?? "",
      quantity: new Prisma.Decimal(0),
      value: new Prisma.Decimal(0),
      valuationKnown: false,
      unit: product?.unit ?? row.unit,
    };
    const sign = row.direction === StockDirection.IN ? 1 : -1;
    const quantity = new Prisma.Decimal(row.quantity);
    const averageRate = current.quantity.isZero() ? null : current.value.div(current.quantity);
    let rate: Prisma.Decimal | null = averageRate;
    if (row.direction === StockDirection.IN) {
      rate = row.sourceType === "OPENING_STOCK" || row.sourceType === "ADJUSTMENT" ? openingRateById.get(row.sourceId) ?? rate
        : row.sourceType === "LOCAL_PURCHASE" ? localRateById.get(row.sourceId) ?? rate
          : row.sourceType === "IMPORT_ARRIVAL" ? loadingRateById.get(row.sourceId) ?? rate
            : row.sourceType === "PARTIAL_RECEIVING" ? receivingRateById.get(row.sourceId) ?? rate
              : row.sourceType === "DECANTING" ? decantingRateById.get(row.sourceId) ?? rate
                : row.sourceType === "DOLLAR_SALE" ? dollarRateById.get(row.sourceId) ?? rate
                  : row.sourceType === "PLANT_TRANSFER" ? transferRateById.get(row.sourceId) ?? rate
                    : row.sourceType === "LOSS_GAIN" ? lossGainRateById.get(row.sourceId) ?? rate
                      : rate;
    }
    if (rate) {
      current.valuationKnown = true;
      current.value = current.value.plus(rate.mul(quantity).mul(sign));
    }
    current.quantity = current.quantity.plus(quantity.mul(sign));
    if (row.direction === StockDirection.OUT && (row.sourceType === "PLANT_TRANSFER" || row.sourceType === "DECANTING")) {
      transferRateById.set(row.sourceId, rate ?? new Prisma.Decimal(0));
    }
    byKey.set(key, current);
  }

  return [...byKey.values()]
    .filter((row) => !row.quantity.isZero())
    .map(({ value, valuationKnown, ...row }) => ({ ...row, quantity: row.quantity.toNumber(), amount: valuationKnown ? value.toNumber() : null }))
    .sort((a, b) => `${a.productCode}:${a.locationCode}`.localeCompare(`${b.productCode}:${b.locationCode}`));
}

async function computeInTransit(tx: Tx, context: Context) {
  const [loadings, partialReceivings] = await Promise.all([
    tx.loading.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, shipmentStatus: "IN_TRANSIT" },
      orderBy: { loadingDate: "asc" },
      select: { id: true, loadingNo: true, quantityLoaded: true, unit: true, contract: { select: { contractNo: true } } },
    }),
    tx.partialReceiving.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, arrivalStatus: "IN_TRANSIT" },
      orderBy: { transactionDate: "asc" },
      select: { id: true, documentNo: true, remainingQuantity: true, unit: true },
    }),
  ]);

  return {
    booked: loadings.map((loading) => ({
      id: loading.id,
      label: `${loading.loadingNo} · ${loading.contract.contractNo}`,
      quantity: n(loading.quantityLoaded),
      unit: loading.unit,
    })),
    unbooked: partialReceivings.map((receiving) => ({
      id: receiving.id,
      label: receiving.documentNo,
      quantity: n(receiving.remainingQuantity),
      unit: receiving.unit,
    })),
  };
}

async function computeSaleStats(tx: Tx, context: Context, today: Date, monthStart: Date, selectedMonth: { start: Date; end: Date; year: number; month: number }) {
  const vBase = { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true };
  const revenueFilter = { companyId: context.companyId, accountType: AccountType.REVENUE };
  const [todayAgg, monthAgg] = await Promise.all([
    tx.accountingVoucherLine.aggregate({
      where: { account: revenueFilter, voucher: { ...vBase, voucherDate: { gte: today, lte: today } } },
      _sum: { credit: true },
      _count: { id: true },
    }),
    tx.accountingVoucherLine.aggregate({
      where: { account: revenueFilter, voucher: { ...vBase, voucherDate: { gte: selectedMonth.start, lte: selectedMonth.end } } },
      _sum: { credit: true },
      _count: { id: true },
    }),
  ]);
  return {
    today: { count: todayAgg._count.id, amount: n(todayAgg._sum.credit) },
    month: { count: monthAgg._count.id, amount: n(monthAgg._sum.credit), year: selectedMonth.year, month: selectedMonth.month },
  };
}

export async function getDashboardData(context: Context, period?: { month?: number; year?: number }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const today = todayUtc();
    const monthStart = monthStartUtc();
    const selectedMonth = selectedMonthRangeUtc(period?.month, period?.year);
    const [kpis, bankPosition, currentStock, bulkStock, inTransit, saleStats, backups] = await Promise.all([
      computeKpis(tx, context, today, monthStart),
      computeBankPosition(tx, context),
      computeCurrentStock(tx, context),
      computeBulkStock(tx, context),
      computeInTransit(tx, context),
      computeSaleStats(tx, context, today, monthStart, selectedMonth),
      Promise.resolve(listBackupFiles()),
    ]);
    const lastBackupAt = backups[0]?.createdAt ?? null;
    const backupStaleDays = lastBackupAt
      ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const needsFirstBackup = lastBackupAt === null;
    const isStale = backupStaleDays !== null && backupStaleDays > 3;
    return {
      kpis,
      bankPosition,
      currentStock,
      bulkStock,
      inTransit,
      saleStats,
      backup: {
        lastBackupAt,
        backupStaleDays,
        needsFirstBackup,
        isStale,
      },
    };
  });
}
