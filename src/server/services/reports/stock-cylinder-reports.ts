import { PermissionAction, StockDirection, StockSourceType, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { parseReportFilters, type ReportFilters } from "./operational-reports.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Tx = Prisma.TransactionClient;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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

const SOURCE_TYPE_LABELS: Record<string, string> = {
  OPENING_BALANCE: "Opening Balance",
  PURCHASE_FILLED: "Purchase",
  SALE_LPG: "Sale",
  CYLINDER_RETURN: "Return",
  PURCHASE_RETURN: "Purchase Return",
  ADJUSTMENT: "Adjustment",
};

function sourceTypeLabel(sourceType: string) {
  return SOURCE_TYPE_LABELS[sourceType] ?? sourceType;
}

// ── Customer Stock Ledger ─────────────────────────────────────────────────────

export async function getCustomerStockLedgerReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);
    if (!filters.customerId) throw new Error("customerId is required for customer stock ledger.");

    const entries = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        customerId: filters.customerId,
        itemId: filters.itemId,
        transactionDate: dateWhere(filters),
      },
      select: {
        id: true,
        sourceId: true,
        sourceType: true,
        transactionDate: true,
        itemId: true,
        cylinderState: true,
        direction: true,
        quantity: true,
        balanceAfter: true,
        remarks: true,
      },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    });

    if (entries.length === 0) return [];

    const itemIds = [...new Set(entries.map((e) => e.itemId))];
    const items = await tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, code: true, name: true },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    return entries.map((e) => {
      const item = itemMap.get(e.itemId);
      return {
        id: e.id,
        transactionDate: formatDate(e.transactionDate),
        documentNo: e.sourceId,
        sourceType: sourceTypeLabel(e.sourceType),
        itemCode: item?.code ?? "",
        itemName: item?.name ?? "",
        cylinderState: e.cylinderState,
        direction: e.direction,
        quantity: e.quantity,
        balanceAfter: e.balanceAfter,
        remarks: e.remarks ?? "",
      };
    });
  });
}

export async function getCustomerStockLedgerReportCsv(context: Context, input: ReportFilters = {}) {
  const rows = await getCustomerStockLedgerReport(context, input);
  return toCsv(
    ["Date", "Document No", "Type", "Item Code", "Item Name", "State", "Direction", "Quantity", "Balance After", "Remarks"],
    rows.map((r) => [r.transactionDate, r.documentNo, r.sourceType, r.itemCode, r.itemName, r.cylinderState, r.direction, r.quantity, r.balanceAfter, r.remarks]),
  );
}

// ── Cylinder Conversion B/W Date ──────────────────────────────────────────────

export async function getCylinderConversionReport(context: Context, input: ReportFilters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const filters = parseReportFilters(input);

    // ADJUSTMENT is exclusively used by cylinder conversions in this codebase
    const entries = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: StockSourceType.ADJUSTMENT,
        transactionDate: dateWhere(filters),
        itemId: filters.itemId,
      },
      select: {
        sourceId: true,
        transactionDate: true,
        itemId: true,
        cylinderState: true,
        direction: true,
        quantity: true,
        remarks: true,
      },
      orderBy: [{ transactionDate: "asc" }, { sourceId: "asc" }],
    });

    if (entries.length === 0) return [];

    const sourceIds = [...new Set(entries.map((e) => e.sourceId))];
    const itemIds = [...new Set(entries.map((e) => e.itemId))];

    const [items, auditLogs] = await Promise.all([
      tx.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, name: true } }),
      tx.auditLog.findMany({
        where: { companyId: context.companyId, entityType: "CylinderConversion", entityId: { in: sourceIds } },
        select: { entityId: true, after: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const itemMap = new Map(items.map((i) => [i.id, i]));

    // Keep only sourceIds that have a CylinderConversion audit log entry
    const conversionIds = new Set(auditLogs.map((l) => l.entityId));
    const auditMap = new Map<string, { referenceNo?: string; remarks?: string }>();
    for (const log of auditLogs) {
      if (!auditMap.has(log.entityId)) {
        const after = log.after as { referenceNo?: string; remarks?: string } | null;
        auditMap.set(log.entityId, { referenceNo: after?.referenceNo, remarks: after?.remarks });
      }
    }

    // Group entries by sourceId → reconstruct each conversion
    const byConversion = new Map<string, {
      conversionNo: string;
      transactionDate: Date;
      fromItemId: string;
      fromState: string;
      fromQty: number;
      toItemId: string;
      toState: string;
      toQty: number;
      remarks: string;
    }>();

    for (const entry of entries) {
      if (!conversionIds.has(entry.sourceId)) continue;
      const current = byConversion.get(entry.sourceId) ?? {
        conversionNo: entry.sourceId,
        transactionDate: entry.transactionDate,
        fromItemId: "",
        fromState: "",
        fromQty: 0,
        toItemId: "",
        toState: "",
        toQty: 0,
        remarks: auditMap.get(entry.sourceId)?.remarks ?? entry.remarks ?? "",
      };
      if (entry.direction === StockDirection.OUT) {
        current.fromItemId = entry.itemId;
        current.fromState = entry.cylinderState;
        current.fromQty = entry.quantity;
      } else {
        current.toItemId = entry.itemId;
        current.toState = entry.cylinderState;
        current.toQty = entry.quantity;
      }
      byConversion.set(entry.sourceId, current);
    }

    return [...byConversion.values()].map((c) => {
      const fromItem = itemMap.get(c.fromItemId);
      const toItem = itemMap.get(c.toItemId);
      const audit = auditMap.get(c.conversionNo);
      return {
        conversionNo: c.conversionNo,
        referenceNo: audit?.referenceNo ?? "",
        transactionDate: formatDate(c.transactionDate),
        fromItemCode: fromItem?.code ?? "",
        fromItemName: fromItem?.name ?? "",
        fromState: c.fromState,
        fromQty: c.fromQty,
        toItemCode: toItem?.code ?? "",
        toItemName: toItem?.name ?? "",
        toState: c.toState,
        toQty: c.toQty,
        remarks: c.remarks,
      };
    });
  });
}

export async function getCylinderConversionReportCsv(context: Context, input: ReportFilters = {}) {
  const rows = await getCylinderConversionReport(context, input);
  return toCsv(
    ["Conversion No", "Ref No", "Date", "From Item Code", "From Item Name", "From State", "From Qty", "To Item Code", "To Item Name", "To State", "To Qty", "Remarks"],
    rows.map((r) => [r.conversionNo, r.referenceNo, r.transactionDate, r.fromItemCode, r.fromItemName, r.fromState, r.fromQty, r.toItemCode, r.toItemName, r.toState, r.toQty, r.remarks]),
  );
}
