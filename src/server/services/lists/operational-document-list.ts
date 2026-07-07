import { PermissionAction, StockSourceType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

export type DocumentListInput = {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  search?: string;
};

type ListContext = { companyId: string; financialYearId: string; userId: string };

function parseDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function inDateRange(value: unknown, from?: Date, to?: Date) {
  const date = parseDate(value);
  if (!date) return !from && !to;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

async function listVoucherDocuments(
  context: ListContext,
  input: DocumentListInput & { module: string; sourceType: string; auditEntityType: string },
  mapRow: (args: {
    documentNo: string;
    voucherId: string | null;
    transactionDate: Date;
    after: Record<string, unknown>;
  }) => Record<string, unknown>,
) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, input.module, PermissionAction.VIEW);
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;
    if (to) to.setUTCHours(23, 59, 59, 999);
    const pageSize = Math.min(Math.max(input.limit ?? 10, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const search = input.search?.trim().toLowerCase();

    const vouchers = await tx.accountingVoucher.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: input.sourceType,
        ...(from || to
          ? {
              voucherDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        voucherNo: true,
        voucherDate: true,
        sourceId: true,
        totalDebit: true,
      },
    });

    const documentNos = vouchers.map((voucher) => voucher.sourceId ?? "").filter(Boolean);
    const logs = documentNos.length
      ? await tx.auditLog.findMany({
          where: { companyId: context.companyId, entityType: input.auditEntityType, entityId: { in: documentNos } },
          select: { entityId: true, after: true },
        })
      : [];
    const afterByDocument = new Map(logs.map((log) => [log.entityId, (log.after ?? {}) as Record<string, unknown>]));

    const rows = vouchers.map((voucher) => {
      const documentNo = voucher.sourceId ?? voucher.voucherNo;
      const after = afterByDocument.get(documentNo) ?? {};
      return mapRow({
        documentNo,
        voucherId: voucher.id,
        transactionDate: voucher.voucherDate,
        after,
      });
    });

    const filtered = search
      ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search))
      : rows;

    return {
      rows: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      limit: pageSize,
      offset,
    };
  });
}

function lineReturnTypeSummary(lines: unknown) {
  if (!Array.isArray(lines) || lines.length === 0) return "Empty";
  const types = [...new Set(lines.map((line) => String((line as Record<string, unknown>).returnType ?? "Empty")))];
  return types.length === 1 ? types[0] : types.join("/");
}

export async function listPurchaseEmptyCylinder(context: ListContext, input: DocumentListInput) {
  const result = await listVoucherDocuments(
    context,
    { ...input, module: "purchase-filled-cylinders", sourceType: "PurchaseEmptyCylinder", auditEntityType: "PurchaseEmptyCylinder" },
    ({ documentNo, voucherId, transactionDate, after }) => ({
      receiptNo: documentNo,
      voucherId,
      transactionDate,
      vendorCode: String(after.vendor ?? "").split(" - ")[0] ?? "",
      vendorName: String(after.vendor ?? after.vendorId ?? ""),
    }),
  );
  return { purchases: result.rows, total: result.total, limit: result.limit, offset: result.offset };
}

export async function listPurchaseOther(context: ListContext, input: DocumentListInput) {
  const result = await listVoucherDocuments(
    context,
    { ...input, module: "purchase-filled-cylinders", sourceType: "PurchaseOther", auditEntityType: "PurchaseOther" },
    ({ documentNo, voucherId, transactionDate, after }) => ({
      receiptNo: documentNo,
      voucherId,
      transactionDate,
      vendorCode: String(after.vendor ?? "").split(" - ")[0] ?? "",
      vendorName: String(after.vendor ?? after.vendorId ?? ""),
    }),
  );
  return { purchases: result.rows, total: result.total, limit: result.limit, offset: result.offset };
}

export async function listCylinderReturns(context: ListContext, input: DocumentListInput) {
  const customers = await prisma.customer.findMany({
    where: { companyId: context.companyId },
    select: { id: true, name: true, code: true },
  });
  const customerById = new Map(customers.map((row) => [row.id, row]));

  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "cylinder-returns", PermissionAction.VIEW);
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;
    if (to) to.setUTCHours(23, 59, 59, 999);
    const pageSize = Math.min(Math.max(input.limit ?? 10, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const search = input.search?.trim().toLowerCase();

    const stockReturns = await tx.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceType: StockSourceType.CYLINDER_RETURN,
      },
      select: { sourceId: true },
    });
    const returnNos = [...new Set(stockReturns.map((entry) => entry.sourceId).filter(Boolean))];
    if (returnNos.length === 0) {
      return { returns: [], total: 0, limit: pageSize, offset };
    }

    const logs = await tx.auditLog.findMany({
      where: { companyId: context.companyId, entityType: "CylinderReturn", entityId: { in: returnNos } },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, after: true, createdAt: true },
    });

    const vouchers = await tx.accountingVoucher.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        sourceId: { in: returnNos },
      },
      select: { id: true, sourceId: true },
    });
    const voucherIdByDocument = new Map(vouchers.map((voucher) => [voucher.sourceId ?? "", voucher.id]));

    const rows = logs
      .map((log) => {
        const after = (log.after ?? {}) as Record<string, unknown>;
        const transactionDate = parseDate(after.transactionDate) ?? log.createdAt;
        if (!inDateRange(transactionDate, from, to)) return null;
        const customerId = String(after.customerId ?? "");
        const customer = customerById.get(customerId);
        return {
          returnNo: log.entityId,
          voucherId: voucherIdByDocument.get(log.entityId) ?? null,
          transactionDate,
          customerName: customer?.name ?? customerId,
          returnType: lineReturnTypeSummary(after.lines),
          totalAmount: String(after.netReturnAmount ?? after.totalAmount ?? "0"),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const filtered = search
      ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search))
      : rows;

    return {
      returns: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      limit: pageSize,
      offset,
    };
  });
}

export async function listEmptySales(context: ListContext, input: DocumentListInput) {
  const result = await listVoucherDocuments(
    context,
    { ...input, module: "empty-sales", sourceType: "EmptySale", auditEntityType: "EmptySale" },
    ({ documentNo, voucherId, transactionDate, after }) => ({
      issueNo: documentNo,
      voucherId,
      transactionDate,
      customerName: String(after.customer ?? after.customerId ?? ""),
      totalAmount: String(after.netReceivableAmount ?? after.totalAmount ?? "0"),
    }),
  );
  return { sales: result.rows, total: result.total, limit: result.limit, offset: result.offset };
}

export async function listDecantingSales(context: ListContext, input: DocumentListInput) {
  const result = await listVoucherDocuments(
    context,
    { ...input, module: "decanting-sales", sourceType: "DecantingSale", auditEntityType: "DecantingSale" },
    ({ documentNo, voucherId, transactionDate, after }) => ({
      issueNo: documentNo,
      voucherId,
      transactionDate,
      itemName: String(after.sourceItem ?? after.sourceItemId ?? ""),
      totalQty: String(after.decantedQuantity ?? after.sourceQuantity ?? "0"),
      totalAmount: String(after.totalAmount ?? "0"),
    }),
  );
  return { sales: result.rows, total: result.total, limit: result.limit, offset: result.offset };
}

export async function listSecurityReceipts(context: ListContext, input: DocumentListInput) {
  const customers = await prisma.customer.findMany({
    where: { companyId: context.companyId },
    select: { id: true, name: true },
  });
  const items = await prisma.item.findMany({
    where: { companyId: context.companyId },
    select: { id: true, name: true, code: true },
  });
  const customerById = new Map(customers.map((row) => [row.id, row]));
  const itemById = new Map(items.map((row) => [row.id, row]));

  const result = await listVoucherDocuments(
    context,
    { ...input, module: "cash-receipts", sourceType: "SecurityReceipt", auditEntityType: "SecurityReceipt" },
    ({ documentNo, voucherId, transactionDate, after }) => {
      const customer = customerById.get(String(after.customerId ?? ""));
      const item = itemById.get(String(after.itemId ?? ""));
      const itemLabel = item ? [item.code, item.name].filter(Boolean).join(" - ") : String(after.itemId ?? "");
      return {
        receiptNo: documentNo,
        voucherId,
        transactionDate,
        customerName: customer?.name ?? String(after.customerId ?? ""),
        cylinder: itemLabel,
        quantity: String(after.quantity ?? "1"),
        amount: String(after.amount ?? "0"),
      };
    },
  );
  return { receipts: result.rows, total: result.total, limit: result.limit, offset: result.offset };
}
