import { CylinderState, PermissionAction, StockDirection, StockSourceType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "./day-closing.ts";
import { createStockLedgerEntry } from "./stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type CylinderConversionInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  conversionNo: string;
  fromItemId: string;
  fromQuantity: number;
  toItemId: string;
  toQuantity: number;
  transactionDate: string | Date;
  remarks?: string;
  referenceNo?: string;
  fromCylinderState?: CylinderState | string;
  toCylinderState?: CylinderState | string;
  allowClosedDayOverride?: boolean;
};

function normalizeQuantity(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}

function normalizeCylinderState(value: CylinderConversionInput["fromCylinderState"]) {
  return String(value) === CylinderState.EMPTY ? CylinderState.EMPTY : CylinderState.FILLED;
}

export async function cylinderConversion(input: CylinderConversionInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "cylinder-conversions", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const fromQuantity = normalizeQuantity(input.fromQuantity, "fromQuantity");
    const toQuantity = normalizeQuantity(input.toQuantity, "toQuantity");
    const fromCylinderState = normalizeCylinderState(input.fromCylinderState);
    const toCylinderState = normalizeCylinderState(input.toCylinderState);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [input.fromItemId, input.toItemId] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    if (!itemById.has(input.fromItemId)) throw new Error("fromItemId is invalid.");
    if (!itemById.has(input.toItemId)) throw new Error("toItemId is invalid.");

    const fromStockEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: input.fromItemId,
      cylinderState: fromCylinderState,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.ADJUSTMENT,
      sourceId: input.conversionNo,
      transactionDate: input.transactionDate,
      quantity: fromQuantity,
      createdById: input.userId,
      remarks: input.remarks,
    });

    const toStockEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: input.toItemId,
      cylinderState: toCylinderState,
      direction: StockDirection.IN,
      sourceType: StockSourceType.ADJUSTMENT,
      sourceId: input.conversionNo,
      transactionDate: input.transactionDate,
      quantity: toQuantity,
      createdById: input.userId,
      remarks: input.remarks,
    });

    const lineItems = [
      {
        section: "From",
        itemId: input.fromItemId,
        item: [itemById.get(input.fromItemId)?.code, itemById.get(input.fromItemId)?.name].filter(Boolean).join(" - "),
        cylinderState: fromCylinderState,
        direction: StockDirection.OUT,
        quantity: fromQuantity,
      },
      {
        section: "To",
        itemId: input.toItemId,
        item: [itemById.get(input.toItemId)?.code, itemById.get(input.toItemId)?.name].filter(Boolean).join(" - "),
        cylinderState: toCylinderState,
        direction: StockDirection.IN,
        quantity: toQuantity,
      },
    ];

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "CylinderConversion",
      entityId: input.conversionNo,
      after: {
        conversionNo: input.conversionNo,
        referenceNo: input.referenceNo,
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        lines: lineItems,
      },
    });

    return {
      conversionNo: input.conversionNo,
      stockEntries: [fromStockEntry, toStockEntry],
    };
  });
}
