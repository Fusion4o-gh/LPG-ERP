import { CylinderState, PermissionAction, StockDirection, StockSourceType, VoucherType, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
export type ReportFilters = { from?: string; to?: string; itemId?: string; customerId?: string };

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatQuantity(value: number | null | undefined) {
  return String(value ?? 0);
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function dateOnly(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date.`);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function parseReportFilters(input: ReportFilters) {
  const from = input.from ? dateOnly(input.from, "from") : undefined;
  const to = input.to ? dateOnly(input.to, "to") : undefined;
  if (from && to && from.getTime() > to.getTime()) throw new Error("from must be before or equal to to.");
  return { from, to, itemId: input.itemId || undefined, customerId: input.customerId || undefined };
}

function dateWhere(filters: ReturnType<typeof parseReportFilters>) {
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

function signedQuantity(direction: StockDirection, quantity: number) {
  return direction === StockDirection.IN ? quantity : -quantity;
}

export async function getStockSummaryReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const rows = await tx.stockLedgerEntry.groupBy({
      by: ["itemId", "cylinderState", "direction"],
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        itemId: filters.itemId,
        transactionDate: dateWhere(filters),
      },
      _sum: { quantity: true },
    });
    const items = await tx.item.findMany({
      where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));
    const byItem = new Map<string, { id: string; item: { code: string; name: string } | undefined; filledQuantity: number; emptyQuantity: number; netMovement: number }>();

    for (const row of rows) {
      const current = byItem.get(row.itemId) ?? {
        id: row.itemId,
        item: itemById.get(row.itemId),
        filledQuantity: 0,
        emptyQuantity: 0,
        netMovement: 0,
      };
      const signed = signedQuantity(row.direction, row._sum.quantity ?? 0);
      if (row.cylinderState === CylinderState.FILLED) current.filledQuantity += signed;
      if (row.cylinderState === CylinderState.EMPTY) current.emptyQuantity += signed;
      current.netMovement += signed;
      byItem.set(row.itemId, current);
    }

    return [...byItem.values()].sort((a, b) => `${a.item?.code ?? ""}`.localeCompare(`${b.item?.code ?? ""}`));
  });
}

export async function getCustomerCylinderBalanceReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const balances = await tx.customerCylinderBalance.findMany({
      where: {
        customerId: filters.customerId,
        itemId: filters.itemId,
        customer: { companyId: context.companyId },
      },
      include: {
        customer: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ customer: { name: "asc" } }, { item: { code: "asc" } }],
      take: 500,
    });

    return Promise.all(
      balances.map(async (balance) => {
        const lastMovement = await tx.stockLedgerEntry.findFirst({
          where: {
            companyId: context.companyId,
            financialYearId: context.financialYearId,
            customerId: balance.customerId,
            itemId: balance.itemId,
            transactionDate: dateWhere(filters),
          },
          orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
          select: { transactionDate: true },
        });
        return {
          id: balance.id,
          customer: balance.customer,
          item: balance.item,
          outstandingEmptyCylinders: balance.emptyOwed,
          lastMovementDate: lastMovement?.transactionDate ?? null,
        };
      }),
    );
  });
}

export async function getDailyActivityReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const stockWhere: Prisma.StockLedgerEntryWhereInput = {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      transactionDate: dateWhere(filters),
    };
    const voucherWhere: Prisma.AccountingVoucherWhereInput = {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      voucherDate: dateWhere(filters),
    };
    const [stockSources, voucherTypes, stockMovements] = await Promise.all([
      tx.stockLedgerEntry.groupBy({
        by: ["sourceType", "sourceId"],
        where: { ...stockWhere, sourceType: { in: [StockSourceType.SALE_LPG, StockSourceType.PURCHASE_FILLED, StockSourceType.CYLINDER_RETURN] } },
      }),
      tx.accountingVoucher.groupBy({
        by: ["voucherType"],
        where: { ...voucherWhere, voucherType: { in: [VoucherType.CR, VoucherType.CP, VoucherType.BR, VoucherType.BP] } },
        _count: { _all: true },
      }),
      tx.stockLedgerEntry.count({ where: stockWhere }),
    ]);

    const sourceCount = (sourceType: StockSourceType) => stockSources.filter((source) => source.sourceType === sourceType).length;
    const voucherCount = (types: VoucherType[]) =>
      voucherTypes.filter((row) => types.includes(row.voucherType)).reduce((total, row) => total + row._count._all, 0);

    return {
      salesCount: sourceCount(StockSourceType.SALE_LPG),
      purchaseCount: sourceCount(StockSourceType.PURCHASE_FILLED),
      cylinderReturnsCount: sourceCount(StockSourceType.CYLINDER_RETURN),
      cashVoucherCount: voucherCount([VoucherType.CR, VoucherType.CP]),
      bankVoucherCount: voucherCount([VoucherType.BR, VoucherType.BP]),
      stockMovements,
    };
  });
}

export async function getStockSummaryReportCsv(context: Context, input: ReportFilters = {}) {
  const rows = await getStockSummaryReport(context, input);
  return toCsv(
    ["Item Code", "Item Name", "Filled Quantity", "Empty Quantity", "Net Movement"],
    rows.map((row) => [row.item?.code ?? "", row.item?.name ?? "", formatQuantity(row.filledQuantity), formatQuantity(row.emptyQuantity), formatQuantity(row.netMovement)]),
  );
}

export async function getCustomerCylinderBalanceReportCsv(context: Context, input: ReportFilters = {}) {
  const rows = await getCustomerCylinderBalanceReport(context, input);
  return toCsv(
    ["Customer Code", "Customer Name", "Item Code", "Item Name", "Outstanding Empty Cylinders", "Last Movement Date"],
    rows.map((row) => [
      row.customer.code,
      row.customer.name,
      row.item.code,
      row.item.name,
      formatQuantity(row.outstandingEmptyCylinders),
      formatDate(row.lastMovementDate),
    ]),
  );
}

export async function getDailyActivityReportCsv(context: Context, input: ReportFilters = {}) {
  const summary = await getDailyActivityReport(context, input);
  return toCsv(
    ["Sales Count", "Purchase Count", "Cylinder Returns Count", "Cash Voucher Count", "Bank Voucher Count", "Stock Movements"],
    [[summary.salesCount, summary.purchaseCount, summary.cylinderReturnsCount, summary.cashVoucherCount, summary.bankVoucherCount, summary.stockMovements]],
  );
}
