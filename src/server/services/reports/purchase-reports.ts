import { PermissionAction, StockDirection, StockSourceType, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { parseReportFilters, type ReportFilters } from "./operational-reports.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Tx = Prisma.TransactionClient;

export type PurchaseReportFilters = ReportFilters & { vendorId?: string };

function parsePurchaseFilters(input: PurchaseReportFilters) {
  const base = parseReportFilters(input);
  return { ...base, vendorId: input.vendorId || undefined };
}

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

function dateWhere(filters: ReturnType<typeof parsePurchaseFilters>) {
  return {
    ...(filters.from ? { gte: filters.from } : {}),
    ...(filters.to ? { lte: filters.to } : {}),
  };
}

export async function getVendorWiseReceivingReport(context: Context, input: PurchaseReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parsePurchaseFilters(input);

    const entries = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: StockSourceType.PURCHASE_FILLED,
        direction: StockDirection.IN,
        transactionDate: dateWhere(filters),
        vendorId: filters.vendorId,
        itemId: filters.itemId,
      },
      select: {
        sourceId: true,
        transactionDate: true,
        vendorId: true,
        itemId: true,
        cylinderState: true,
        quantity: true,
      },
      orderBy: [{ transactionDate: "asc" }, { sourceId: "asc" }],
    });

    if (entries.length === 0) return [];

    const vendorIds = [...new Set(entries.map((e) => e.vendorId).filter((id): id is string => !!id))];
    const itemIds = [...new Set(entries.map((e) => e.itemId))];
    const sourceIds = [...new Set(entries.map((e) => e.sourceId))];

    const [vendors, items, vouchers] = await Promise.all([
      vendorIds.length > 0
        ? tx.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, code: true, name: true } })
        : Promise.resolve([]),
      tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, name: true } }),
      tx.accountingVoucher.findMany({
        where: { companyId: context.companyId, sourceId: { in: sourceIds } },
        select: { sourceId: true, totalDebit: true },
      }),
    ]);

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const voucherMap = new Map(vouchers.map((v) => [v.sourceId!, v.totalDebit]));

    type Key = `${string}:${string}:${string}`;
    const byKey = new Map<Key, {
      receiptNo: string;
      transactionDate: Date;
      vendorId: string | null;
      itemId: string;
      cylinderState: string;
      quantity: number;
    }>();

    for (const entry of entries) {
      const key: Key = `${entry.sourceId}:${entry.itemId}:${entry.cylinderState}`;
      const current = byKey.get(key) ?? {
        receiptNo: entry.sourceId,
        transactionDate: entry.transactionDate,
        vendorId: entry.vendorId,
        itemId: entry.itemId,
        cylinderState: entry.cylinderState,
        quantity: 0,
      };
      current.quantity += entry.quantity;
      byKey.set(key, current);
    }

    return [...byKey.values()].map((row) => {
      const vendor = vendorMap.get(row.vendorId ?? "");
      const item = itemMap.get(row.itemId);
      return {
        receiptNo: row.receiptNo,
        transactionDate: formatDate(row.transactionDate),
        vendorCode: vendor?.code ?? "",
        vendorName: vendor?.name ?? "",
        itemCode: item?.code ?? "",
        itemName: item?.name ?? "",
        cylinderState: row.cylinderState,
        quantity: row.quantity,
        purchaseAmount: formatMoney(voucherMap.get(row.receiptNo)),
      };
    });
  });
}

export async function getPurchaseReturnReport(context: Context, input: PurchaseReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parsePurchaseFilters(input);
    const dw = dateWhere(filters);

    // Cylinder returns: have stock ledger entries
    const cylinderEntries = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: StockSourceType.PURCHASE_RETURN,
        direction: StockDirection.OUT,
        transactionDate: dw,
        vendorId: filters.vendorId,
        itemId: filters.itemId,
      },
      select: {
        sourceId: true,
        transactionDate: true,
        vendorId: true,
        itemId: true,
        quantity: true,
      },
      orderBy: [{ transactionDate: "asc" }, { sourceId: "asc" }],
    });

    // Other returns: only in accounting vouchers (skip if item filter is active — no stock = no item info)
    const otherVouchers = filters.itemId
      ? []
      : await tx.accountingVoucher.findMany({
          where: {
            companyId: context.companyId,
            financialYearId: context.financialYearId,
            sourceType: "PurchaseReturnOther",
            voucherDate: dw,
          },
          select: { sourceId: true, voucherDate: true, totalDebit: true },
          orderBy: { voucherDate: "asc" },
        });

    const cylinderSourceIds = [...new Set(cylinderEntries.map((e) => e.sourceId))];
    const otherSourceIds = otherVouchers.map((v) => v.sourceId!).filter(Boolean);
    const allSourceIds = [...cylinderSourceIds, ...otherSourceIds];

    if (allSourceIds.length === 0) return [];

    const vendorIdsFromCylinder = [...new Set(cylinderEntries.map((e) => e.vendorId).filter((id): id is string => !!id))];
    const itemIds = [...new Set(cylinderEntries.map((e) => e.itemId))];

    // Audit logs give us vendorId for "other" returns
    const otherAuditLogs =
      otherSourceIds.length > 0
        ? await tx.auditLog.findMany({
            where: { companyId: context.companyId, entityType: "PurchaseReturnOther", entityId: { in: otherSourceIds } },
            select: { entityId: true, after: true },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const otherVendorIdMap = new Map<string, string>();
    for (const log of otherAuditLogs) {
      if (!otherVendorIdMap.has(log.entityId)) {
        const after = log.after as { vendorId?: string } | null;
        if (after?.vendorId) otherVendorIdMap.set(log.entityId, after.vendorId);
      }
    }

    const allVendorIds = [...new Set([...vendorIdsFromCylinder, ...otherVendorIdMap.values()])];

    // Apply vendorId filter to "other" returns
    const filteredOtherSourceIds = filters.vendorId
      ? otherSourceIds.filter((id) => otherVendorIdMap.get(id) === filters.vendorId)
      : otherSourceIds;

    const [vendors, items, cylinderVouchers] = await Promise.all([
      allVendorIds.length > 0
        ? tx.vendor.findMany({ where: { id: { in: allVendorIds } }, select: { id: true, code: true, name: true } })
        : Promise.resolve([]),
      itemIds.length > 0
        ? tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, name: true } })
        : Promise.resolve([]),
      cylinderSourceIds.length > 0
        ? tx.accountingVoucher.findMany({
            where: { companyId: context.companyId, sourceId: { in: cylinderSourceIds } },
            select: { sourceId: true, totalDebit: true },
          })
        : Promise.resolve([]),
    ]);

    const vendorMap = new Map(vendors.map((v) => [v.id, v]));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const cylinderVoucherMap = new Map(cylinderVouchers.map((v) => [v.sourceId!, v.totalDebit]));

    // Build cylinder return rows
    type Key = `${string}:${string}`;
    const cylinderByKey = new Map<Key, {
      returnNo: string;
      transactionDate: Date;
      vendorId: string | null;
      itemId: string;
      quantity: number;
    }>();

    for (const entry of cylinderEntries) {
      const key: Key = `${entry.sourceId}:${entry.itemId}`;
      const current = cylinderByKey.get(key) ?? {
        returnNo: entry.sourceId,
        transactionDate: entry.transactionDate,
        vendorId: entry.vendorId,
        itemId: entry.itemId,
        quantity: 0,
      };
      current.quantity += entry.quantity;
      cylinderByKey.set(key, current);
    }

    const cylinderRows = [...cylinderByKey.values()].map((row) => {
      const vendor = vendorMap.get(row.vendorId ?? "");
      const item = itemMap.get(row.itemId);
      return {
        returnNo: row.returnNo,
        transactionDate: formatDate(row.transactionDate),
        vendorCode: vendor?.code ?? "",
        vendorName: vendor?.name ?? "",
        itemCode: item?.code ?? "",
        itemName: item?.name ?? "",
        quantity: row.quantity,
        returnType: "Cylinder",
        returnAmount: formatMoney(cylinderVoucherMap.get(row.returnNo)),
      };
    });

    // Build "other" return rows
    const otherRows = otherVouchers
      .filter((v) => filteredOtherSourceIds.includes(v.sourceId!))
      .map((v) => {
        const vendorId = otherVendorIdMap.get(v.sourceId!) ?? "";
        const vendor = vendorMap.get(vendorId);
        return {
          returnNo: v.sourceId!,
          transactionDate: formatDate(v.voucherDate),
          vendorCode: vendor?.code ?? "",
          vendorName: vendor?.name ?? "",
          itemCode: "",
          itemName: "",
          quantity: 0,
          returnType: "Other",
          returnAmount: formatMoney(v.totalDebit),
        };
      });

    return [...cylinderRows, ...otherRows].sort((a, b) =>
      a.transactionDate.localeCompare(b.transactionDate) || a.returnNo.localeCompare(b.returnNo),
    );
  });
}

export async function getVendorWiseReceivingReportCsv(context: Context, input: PurchaseReportFilters = {}) {
  const rows = await getVendorWiseReceivingReport(context, input);
  return toCsv(
    ["Receipt No", "Date", "Vendor Code", "Vendor Name", "Item Code", "Item Name", "Cylinder State", "Quantity", "Purchase Amount"],
    rows.map((r) => [r.receiptNo, r.transactionDate, r.vendorCode, r.vendorName, r.itemCode, r.itemName, r.cylinderState, r.quantity, r.purchaseAmount]),
  );
}

export async function getPurchaseReturnReportCsv(context: Context, input: PurchaseReportFilters = {}) {
  const rows = await getPurchaseReturnReport(context, input);
  return toCsv(
    ["Return No", "Date", "Vendor Code", "Vendor Name", "Item Code", "Item Name", "Quantity", "Return Type", "Return Amount"],
    rows.map((r) => [r.returnNo, r.transactionDate, r.vendorCode, r.vendorName, r.itemCode, r.itemName, r.quantity, r.returnType, r.returnAmount]),
  );
}
