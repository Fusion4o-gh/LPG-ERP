import { CylinderState, StockDirection, StockSourceType, TransferStatus, type Prisma } from "@prisma/client";
import { assertFilledStockAvailable } from "../inventory/stock-availability.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { writeAuditLog } from "../audit/audit-log.ts";

type Tx = Prisma.TransactionClient;

export type CreateTransferInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  documentNo: string;
  transferDate: string | Date;
  sourceLocationId: string;
  destinationLocationId: string;
  lines: Array<{
    itemId: string;
    cylinderState: CylinderState;
    quantity: number;
    remarks?: string;
  }>;
};

export type ListTransfersInput = {
  companyId: string;
  financialYearId: string;
  from?: string | Date;
  to?: string | Date;
  status?: TransferStatus;
  limit?: number;
};

export type GetTransferInput = {
  companyId: string;
  id: string;
};

export type CancelTransferInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  id: string;
  remarks?: string;
};

export async function createWarehouseTransfer(tx: Tx, input: CreateTransferInput) {
  if (input.sourceLocationId === input.destinationLocationId) {
    throw new Error("Source and destination warehouses must be different.");
  }

  if (input.lines.length === 0) {
    throw new Error("At least one transfer line is required.");
  }

  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Line quantity must be a positive integer for item ${line.itemId}.`);
    }
  }

  // For FILLED lines, assert stock is available at source location
  const filledLines = input.lines.filter((line) => line.cylinderState === CylinderState.FILLED);
  if (filledLines.length > 0) {
    await assertFilledStockAvailable(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      locationId: input.sourceLocationId,
      lines: filledLines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
      })),
    });
  }

  const transfer = await tx.warehouseTransfer.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      documentNo: input.documentNo,
      transferDate: new Date(input.transferDate),
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      status: TransferStatus.COMPLETED,
      createdById: input.userId,
      lines: {
        create: input.lines.map((line) => ({
          itemId: line.itemId,
          cylinderState: line.cylinderState,
          quantity: line.quantity,
          remarks: line.remarks,
        })),
      },
    },
    include: { lines: true },
  });

  // Create OUT entry at source and IN entry at destination for each line
  const stockEntries: Array<{ entry: unknown; line: (typeof input.lines)[number] }> = [];
  for (const line of input.lines) {
    const outEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.WAREHOUSE_TRANSFER,
      sourceId: input.documentNo,
      transactionDate: input.transferDate,
      quantity: line.quantity,
      createdById: input.userId,
      locationId: input.sourceLocationId,
    });
    stockEntries.push({ entry: outEntry, line });

    const inEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      direction: StockDirection.IN,
      sourceType: StockSourceType.WAREHOUSE_TRANSFER,
      sourceId: input.documentNo,
      transactionDate: input.transferDate,
      quantity: line.quantity,
      createdById: input.userId,
      locationId: input.destinationLocationId,
    });
    stockEntries.push({ entry: inEntry, line });
  }

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "WarehouseTransfer",
    entityId: input.documentNo,
    after: {
      documentNo: input.documentNo,
      transferDate: input.transferDate,
      sourceLocationId: input.sourceLocationId,
      destinationLocationId: input.destinationLocationId,
      lines: input.lines.map((line) => ({
        itemId: line.itemId,
        cylinderState: line.cylinderState,
        quantity: line.quantity,
      })),
    },
  });

  return { transfer, stockEntries };
}

export async function listWarehouseTransfers(tx: Tx, input: ListTransfersInput) {
  const where: Prisma.WarehouseTransferWhereInput = {
    companyId: input.companyId,
  };

  if (input.from || input.to) {
    where.transferDate = {};
    if (input.from) where.transferDate.gte = new Date(input.from);
    if (input.to) where.transferDate.lte = new Date(input.to);
  }

  if (input.status) {
    where.status = input.status;
  }

  const limit = input.limit ?? 50;

  const transfers = await tx.warehouseTransfer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      _count: { select: { lines: true } },
    },
  });

  return transfers;
}

export async function getWarehouseTransferById(tx: Tx, input: GetTransferInput) {
  const transfer = await tx.warehouseTransfer.findFirst({
    where: {
      id: input.id,
      companyId: input.companyId,
    },
    include: { lines: true },
  });

  if (!transfer) {
    throw new Error("Warehouse transfer not found.");
  }

  return transfer;
}

export async function cancelWarehouseTransfer(tx: Tx, input: CancelTransferInput) {
  const transfer = await tx.warehouseTransfer.findFirst({
    where: {
      id: input.id,
      companyId: input.companyId,
    },
    include: { lines: true },
  });

  if (!transfer) {
    throw new Error("Warehouse transfer not found.");
  }

  if (transfer.status !== TransferStatus.COMPLETED) {
    throw new Error("Only completed transfers can be cancelled.");
  }

  // Create reversal entries for each line
  for (const line of transfer.lines) {
    // IN entry at source location (puts stock back)
    await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      direction: StockDirection.IN,
      sourceType: StockSourceType.WAREHOUSE_TRANSFER,
      sourceId: transfer.documentNo,
      transactionDate: new Date(),
      quantity: line.quantity,
      createdById: input.userId,
      locationId: transfer.sourceLocationId,
      remarks: input.remarks ?? "Transfer cancelled",
    });

    // OUT entry at destination location (removes stock from destination)
    await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.WAREHOUSE_TRANSFER,
      sourceId: transfer.documentNo,
      transactionDate: new Date(),
      quantity: line.quantity,
      createdById: input.userId,
      locationId: transfer.destinationLocationId,
      remarks: input.remarks ?? "Transfer cancelled",
    });
  }

  const updated = await tx.warehouseTransfer.update({
    where: { id: input.id },
    data: {
      status: TransferStatus.CANCELLED,
      remarks: input.remarks ?? transfer.remarks,
    },
    include: { lines: true },
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: "UPDATE",
    entityType: "WarehouseTransfer",
    entityId: transfer.documentNo,
    after: {
      status: TransferStatus.CANCELLED,
      remarks: input.remarks,
    },
  });

  return updated;
}
