import { CylinderState, PermissionAction, StockDirection, StockSourceType, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { parseReportFilters, type ReportFilters } from "./operational-reports.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Tx = Prisma.TransactionClient;
export type SaleReportFilters = ReportFilters & { mode?: string };

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: Prisma.Decimal | string | number | null | undefined) {
  return String(value ?? "0.00");
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function dateWhere(filters: ReturnType<typeof parseReportFilters>) {
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

async function loadSaleEntries(tx: Tx, context: Context, filters: ReturnType<typeof parseReportFilters>) {
  return tx.stockLedgerEntry.findMany({
    where: {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      sourceType: StockSourceType.SALE_LPG,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      transactionDate: dateWhere(filters),
      customerId: filters.customerId ?? undefined,
      itemId: filters.itemId ?? undefined,
    },
    select: {
      sourceId: true,
      transactionDate: true,
      customerId: true,
      itemId: true,
      quantity: true,
    },
    orderBy: [{ transactionDate: "asc" }, { sourceId: "asc" }],
  });
}

async function enrichSaleEntries(tx: Tx, context: Context, entries: Awaited<ReturnType<typeof loadSaleEntries>>) {
  if (entries.length === 0) return { customerMap: new Map(), voucherMap: new Map(), saleTypeMap: new Map() };

  const sourceIds = [...new Set(entries.map((e) => e.sourceId))];
  const customerIds = [...new Set(entries.map((e) => e.customerId).filter((id): id is string => !!id))];

  const [customers, vouchers, auditLogs] = await Promise.all([
    customerIds.length > 0
      ? tx.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, name: true } })
      : Promise.resolve([]),
    tx.accountingVoucher.findMany({
      where: { companyId: context.companyId, sourceType: "SaleLpg", sourceId: { in: sourceIds } },
      select: { sourceId: true, totalDebit: true },
    }),
    tx.auditLog.findMany({
      where: { companyId: context.companyId, entityType: "SaleLpg", entityId: { in: sourceIds } },
      select: { entityId: true, after: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const voucherMap = new Map(vouchers.map((v) => [v.sourceId!, v.totalDebit]));

  const saleTypeMap = new Map<string, string>();
  for (const log of auditLogs) {
    if (!saleTypeMap.has(log.entityId)) {
      const after = log.after as { saleType?: string } | null;
      saleTypeMap.set(log.entityId, after?.saleType ?? "Direct");
    }
  }

  return { customerMap, voucherMap, saleTypeMap };
}

function buildSaleRows(
  entries: Awaited<ReturnType<typeof loadSaleEntries>>,
  customerMap: Map<string, { id: string; code: string; name: string }>,
  voucherMap: Map<string, Prisma.Decimal>,
  saleTypeMap: Map<string, string>,
) {
  const bySale = new Map<string, { issueNo: string; transactionDate: Date; customerId: string | null; totalQty: number }>();

  for (const entry of entries) {
    const current = bySale.get(entry.sourceId) ?? {
      issueNo: entry.sourceId,
      transactionDate: entry.transactionDate,
      customerId: entry.customerId,
      totalQty: 0,
    };
    current.totalQty += entry.quantity;
    bySale.set(entry.sourceId, current);
  }

  return [...bySale.values()].map((sale) => {
    const customer = customerMap.get(sale.customerId ?? "");
    return {
      issueNo: sale.issueNo,
      transactionDate: formatDate(sale.transactionDate),
      customerCode: customer?.code ?? "",
      customerName: customer?.name ?? "",
      totalQty: sale.totalQty,
      saleAmount: formatMoney(voucherMap.get(sale.issueNo)),
      saleType: saleTypeMap.get(sale.issueNo) ?? "Direct",
    };
  });
}

function buildSaleRowsByItem(
  entries: Awaited<ReturnType<typeof loadSaleEntries>>,
  customerMap: Map<string, { id: string; code: string; name: string }>,
  itemMap: Map<string, { id: string; code: string; name: string }>,
  voucherMap: Map<string, Prisma.Decimal>,
) {
  const bySaleItem = new Map<string, { issueNo: string; transactionDate: Date; customerId: string | null; itemId: string; totalQty: number }>();
  for (const entry of entries) {
    const key = `${entry.sourceId}:${entry.itemId}`;
    const current = bySaleItem.get(key) ?? {
      issueNo: entry.sourceId,
      transactionDate: entry.transactionDate,
      customerId: entry.customerId,
      itemId: entry.itemId,
      totalQty: 0,
    };
    current.totalQty += entry.quantity;
    bySaleItem.set(key, current);
  }
  return [...bySaleItem.values()].map((row) => {
    const customer = customerMap.get(row.customerId ?? "");
    const item = itemMap.get(row.itemId);
    return {
      issueNo: row.issueNo,
      transactionDate: formatDate(row.transactionDate),
      customerCode: customer?.code ?? "",
      customerName: customer?.name ?? "",
      itemCode: item?.code ?? "",
      itemName: item?.name ?? "",
      totalQty: row.totalQty,
      saleAmount: formatMoney(voucherMap.get(row.issueNo)),
    };
  });
}

function buildSaleRowsByType(
  rows: ReturnType<typeof buildSaleRows>,
) {
  const byType = new Map<string, { saleType: string; invoiceCount: number; totalQty: number; totalAmount: number }>();
  for (const row of rows) {
    const current = byType.get(row.saleType) ?? { saleType: row.saleType, invoiceCount: 0, totalQty: 0, totalAmount: 0 };
    current.invoiceCount += 1;
    current.totalQty += Number(row.totalQty);
    current.totalAmount += Number(row.saleAmount);
    byType.set(row.saleType, current);
  }
  return [...byType.values()].map((row) => ({
    saleType: row.saleType,
    invoiceCount: row.invoiceCount,
    totalQty: row.totalQty,
    saleAmount: row.totalAmount.toFixed(2),
  }));
}

export async function getSaleBetweenDatesReport(context: Context, input: SaleReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    const mode = (input.mode ?? "invoice").toLowerCase();
    const entries = await loadSaleEntries(tx, context, filters);
    const { customerMap, voucherMap, saleTypeMap } = await enrichSaleEntries(tx, context, entries);

    if (mode === "item") {
      const itemIds = [...new Set(entries.map((e) => e.itemId))];
      const items = await tx.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, code: true, name: true },
      });
      const itemMap = new Map(items.map((i) => [i.id, i]));
      return buildSaleRowsByItem(entries, customerMap, itemMap, voucherMap);
    }

    const invoiceRows = buildSaleRows(entries, customerMap, voucherMap, saleTypeMap);
    if (mode === "type") return buildSaleRowsByType(invoiceRows);
    return invoiceRows;
  });
}

export async function getOneCustomerSaleHistoryReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    if (!filters.customerId) throw new Error("customerId is required for one-customer sale history.");
    const entries = await loadSaleEntries(tx, context, filters);
    const { customerMap, voucherMap, saleTypeMap } = await enrichSaleEntries(tx, context, entries);
    return buildSaleRows(entries, customerMap, voucherMap, saleTypeMap);
  });
}

export async function getSaleReturnReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);

    const entries = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: StockSourceType.CYLINDER_RETURN,
        direction: StockDirection.IN,
        transactionDate: dateWhere(filters),
        customerId: filters.customerId ?? undefined,
        itemId: filters.itemId ?? undefined,
      },
      select: {
        sourceId: true,
        transactionDate: true,
        customerId: true,
        itemId: true,
        quantity: true,
        cylinderState: true,
      },
      orderBy: [{ transactionDate: "asc" }, { sourceId: "asc" }],
    });

    if (entries.length === 0) return [];

    const customerIds = [...new Set(entries.map((e) => e.customerId).filter((id): id is string => !!id))];
    const itemIds = [...new Set(entries.map((e) => e.itemId))];

    const [customers, items] = await Promise.all([
      customerIds.length > 0
        ? tx.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, name: true } })
        : Promise.resolve([]),
      tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, name: true } }),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const itemMap = new Map(items.map((i) => [i.id, i]));

    type ReturnKey = `${string}:${string}:${string}`;
    const byReturnItem = new Map<ReturnKey, {
      returnNo: string;
      transactionDate: Date;
      customerId: string | null;
      itemId: string;
      filledReturned: number;
      emptyReturned: number;
    }>();

    for (const entry of entries) {
      const key: ReturnKey = `${entry.sourceId}:${entry.customerId ?? ""}:${entry.itemId}`;
      const current = byReturnItem.get(key) ?? {
        returnNo: entry.sourceId,
        transactionDate: entry.transactionDate,
        customerId: entry.customerId,
        itemId: entry.itemId,
        filledReturned: 0,
        emptyReturned: 0,
      };
      if (entry.cylinderState === CylinderState.FILLED) current.filledReturned += entry.quantity;
      else current.emptyReturned += entry.quantity;
      byReturnItem.set(key, current);
    }

    return [...byReturnItem.values()].map((row) => {
      const customer = customerMap.get(row.customerId ?? "");
      const item = itemMap.get(row.itemId);
      return {
        returnNo: row.returnNo,
        transactionDate: formatDate(row.transactionDate),
        customerCode: customer?.code ?? "",
        customerName: customer?.name ?? "",
        itemCode: item?.code ?? "",
        itemName: item?.name ?? "",
        filledReturned: row.filledReturned,
        emptyReturned: row.emptyReturned,
      };
    });
  });
}

export async function getSaleBetweenDatesReportCsv(context: Context, input: SaleReportFilters = {}) {
  const rows = await getSaleBetweenDatesReport(context, input);
  const mode = (input.mode ?? "invoice").toLowerCase();
  if (mode === "item") {
    return toCsv(
      ["Issue No", "Date", "Customer Code", "Customer Name", "Item Code", "Item Name", "Qty", "Amount"],
      rows.map((r) => [r.issueNo, r.transactionDate, r.customerCode, r.customerName, r.itemCode, r.itemName, r.totalQty, r.saleAmount]),
    );
  }
  if (mode === "type") {
    return toCsv(
      ["Sale Type", "Invoices", "Qty", "Amount"],
      rows.map((r) => [r.saleType, r.invoiceCount, r.totalQty, r.saleAmount]),
    );
  }
  return toCsv(
    ["Issue No", "Date", "Customer Code", "Customer Name", "Total Qty", "Sale Amount", "Sale Type"],
    rows.map((r) => [r.issueNo, r.transactionDate, r.customerCode, r.customerName, r.totalQty, r.saleAmount, r.saleType]),
  );
}

export async function getOneCustomerSaleHistoryReportCsv(context: Context, input: ReportFilters = {}) {
  const rows = await getOneCustomerSaleHistoryReport(context, input);
  return toCsv(
    ["Issue No", "Date", "Customer Code", "Customer Name", "Total Qty", "Sale Amount", "Sale Type"],
    rows.map((r) => [r.issueNo, r.transactionDate, r.customerCode, r.customerName, r.totalQty, r.saleAmount, r.saleType]),
  );
}

export async function getSaleReturnReportCsv(context: Context, input: ReportFilters = {}) {
  const rows = await getSaleReturnReport(context, input);
  return toCsv(
    ["Return No", "Date", "Customer Code", "Customer Name", "Item Code", "Item Name", "Filled Returned", "Empty Returned"],
    rows.map((r) => [r.returnNo, r.transactionDate, r.customerCode, r.customerName, r.itemCode, r.itemName, r.filledReturned, r.emptyReturned]),
  );
}

export async function getSalewiseProfitReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);

    const saleEntries = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: StockSourceType.SALE_LPG,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.OUT,
        transactionDate: dateWhere(filters),
        customerId: filters.customerId,
        itemId: filters.itemId,
      },
      select: { sourceId: true, transactionDate: true, customerId: true, itemId: true, quantity: true },
      orderBy: [{ transactionDate: "asc" }, { sourceId: "asc" }],
      take: 500,
    });

    if (saleEntries.length === 0) return { rows: [] };

    const sourceIds = [...new Set(saleEntries.map((e) => e.sourceId))];
    const customerIds = [...new Set(saleEntries.map((e) => e.customerId).filter((id): id is string => !!id))];
    const itemIds = [...new Set(saleEntries.map((e) => e.itemId))];

    const [customers, items, saleVouchers] = await Promise.all([
      customerIds.length > 0
        ? tx.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, name: true } })
        : Promise.resolve([]),
      tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, name: true } }),
      tx.accountingVoucher.findMany({
        where: { companyId: context.companyId, sourceType: "SaleLpg", sourceId: { in: sourceIds } },
        select: { sourceId: true, totalDebit: true },
      }),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const saleVoucherMap = new Map(saleVouchers.map((v) => [v.sourceId!, Number(v.totalDebit)]));

    // Cost = financial-year weighted-average purchase cost per item (approximation).
    // Does not reflect the cost at the exact time of sale; suitable for management reporting only.
    const purchaseEntries = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: StockSourceType.PURCHASE_FILLED,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.IN,
        itemId: { in: itemIds },
      },
      select: { sourceId: true, itemId: true, quantity: true },
    });

    const purchaseSourceIds = [...new Set(purchaseEntries.map((e) => e.sourceId))];
    const purchaseVouchers =
      purchaseSourceIds.length > 0
        ? await tx.accountingVoucher.findMany({
            where: { companyId: context.companyId, sourceId: { in: purchaseSourceIds } },
            select: { sourceId: true, totalDebit: true },
          })
        : [];
    const purchaseVoucherMap = new Map(purchaseVouchers.map((v) => [v.sourceId!, Number(v.totalDebit)]));

    const purchaseBySource = new Map<string, Array<{ itemId: string; quantity: number }>>();
    for (const entry of purchaseEntries) {
      const list = purchaseBySource.get(entry.sourceId) ?? [];
      list.push({ itemId: entry.itemId, quantity: entry.quantity });
      purchaseBySource.set(entry.sourceId, list);
    }

    const itemTotalCost = new Map<string, number>();
    const itemTotalQty = new Map<string, number>();
    for (const [srcId, group] of purchaseBySource.entries()) {
      const voucherAmount = purchaseVoucherMap.get(srcId) ?? 0;
      const totalQtyInReceipt = group.reduce((s, e) => s + e.quantity, 0);
      for (const entry of group) {
        const entryAmount = totalQtyInReceipt > 0 ? (entry.quantity / totalQtyInReceipt) * voucherAmount : 0;
        itemTotalCost.set(entry.itemId, (itemTotalCost.get(entry.itemId) ?? 0) + entryAmount);
        itemTotalQty.set(entry.itemId, (itemTotalQty.get(entry.itemId) ?? 0) + entry.quantity);
      }
    }

    const weightedAvgCost = new Map<string, number>();
    for (const [itemId, totalCost] of itemTotalCost.entries()) {
      const totalQty = itemTotalQty.get(itemId) ?? 0;
      weightedAvgCost.set(itemId, totalQty > 0 ? totalCost / totalQty : 0);
    }

    // Build per-sale-per-item rows; prorate sale amount by item qty share within each sale.
    const bySaleItem = new Map<string, { sourceId: string; transactionDate: Date; customerId: string | null; itemId: string; quantity: number }>();
    for (const entry of saleEntries) {
      const key = `${entry.sourceId}:${entry.itemId}`;
      const current = bySaleItem.get(key) ?? { sourceId: entry.sourceId, transactionDate: entry.transactionDate, customerId: entry.customerId, itemId: entry.itemId, quantity: 0 };
      current.quantity += entry.quantity;
      bySaleItem.set(key, current);
    }

    const totalQtyBySale = new Map<string, number>();
    for (const row of bySaleItem.values()) {
      totalQtyBySale.set(row.sourceId, (totalQtyBySale.get(row.sourceId) ?? 0) + row.quantity);
    }

    const rows = [...bySaleItem.values()].map((row) => {
      const customer = customerMap.get(row.customerId ?? "");
      const item = itemMap.get(row.itemId);
      const totalSaleAmount = saleVoucherMap.get(row.sourceId) ?? 0;
      const totalSaleQty = totalQtyBySale.get(row.sourceId) ?? 0;
      const saleAmount = totalSaleQty > 0 ? (row.quantity / totalSaleQty) * totalSaleAmount : 0;
      const costPerUnit = weightedAvgCost.get(row.itemId) ?? 0;
      const costAmount = row.quantity * costPerUnit;
      const grossProfit = saleAmount - costAmount;
      const profitPercent = saleAmount > 0 ? (grossProfit / saleAmount) * 100 : 0;
      return {
        id: `${row.sourceId}:${row.itemId}`,
        issueNo: row.sourceId,
        transactionDate: formatDate(row.transactionDate),
        customerCode: customer?.code ?? "",
        customerName: customer?.name ?? "",
        itemCode: item?.code ?? "",
        itemName: item?.name ?? "",
        quantity: row.quantity,
        saleAmount,
        costAmount,
        grossProfit,
        profitPercent,
      };
    });

    return { rows };
  });
}

export async function getSalewiseProfitReportCsv(context: Context, input: ReportFilters = {}) {
  const { rows } = await getSalewiseProfitReport(context, input);
  return toCsv(
    ["Issue No", "Date", "Customer Code", "Customer Name", "Item Code", "Item Name", "Qty", "Sale Amount", "Cost Amount", "Gross Profit", "Profit %"],
    rows.map((r) => [r.issueNo, r.transactionDate, r.customerCode, r.customerName, r.itemCode, r.itemName, r.quantity, r.saleAmount.toFixed(2), r.costAmount.toFixed(2), r.grossProfit.toFixed(2), r.profitPercent.toFixed(2)]),
  );
}
