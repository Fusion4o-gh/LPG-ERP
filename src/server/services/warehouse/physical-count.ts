import { CountStatus, CylinderState, StockDirection, StockSourceType, type Prisma } from "@prisma/client";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { writeAuditLog } from "../audit/audit-log.ts";

type Tx = Prisma.TransactionClient;

export type CreateCountInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  documentNo: string;
  locationId: string;
  countDate: string | Date;
  notes?: string;
};

export type GetCountInput = {
  companyId: string;
  id: string;
};

export type ListCountsInput = {
  companyId: string;
  financialYearId: string;
  locationId?: string;
  status?: CountStatus;
  from?: string | Date;
  to?: string | Date;
  limit?: number;
};

export type AddLinesInput = {
  companyId: string;
  userId: string;
  countId: string;
  lines: Array<{
    itemId: string;
    cylinderState: CylinderState;
    countedQuantity: number;
    remarks?: string;
  }>;
};

export type ApproveCountInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  countId: string;
};

export async function createPhysicalCount(tx: Tx, input: CreateCountInput) {
  // Validate location exists for this company
  const location = await tx.stockLocation.findFirst({
    where: { id: input.locationId, companyId: input.companyId },
    select: { id: true },
  });

  if (!location) {
    throw new Error("Warehouse location not found.");
  }

  // Concurrent count prevention: no active DRAFT/IN_PROGRESS count at this location
  const activeCount = await tx.physicalCount.findFirst({
    where: {
      companyId: input.companyId,
      locationId: input.locationId,
      status: { in: [CountStatus.DRAFT, CountStatus.IN_PROGRESS] },
    },
    select: { id: true, documentNo: true },
  });

  if (activeCount) {
    throw new Error(
      `An active physical count (${activeCount.documentNo}) already exists at this location. Complete or cancel it before starting a new count.`,
    );
  }

  const count = await tx.physicalCount.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      documentNo: input.documentNo,
      locationId: input.locationId,
      countDate: new Date(input.countDate),
      status: CountStatus.DRAFT,
      notes: input.notes,
      createdById: input.userId,
    },
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "PhysicalCount",
    entityId: input.documentNo,
    after: {
      documentNo: input.documentNo,
      locationId: input.locationId,
      countDate: input.countDate,
      status: CountStatus.DRAFT,
    },
  });

  return count;
}

export async function getPhysicalCountById(tx: Tx, input: GetCountInput) {
  const count = await tx.physicalCount.findFirst({
    where: {
      id: input.id,
      companyId: input.companyId,
    },
    include: { lines: true },
  });

  if (!count) {
    throw new Error("Physical count not found.");
  }

  return count;
}

export async function listPhysicalCounts(tx: Tx, input: ListCountsInput) {
  const where: Prisma.PhysicalCountWhereInput = {
    companyId: input.companyId,
  };

  if (input.locationId) {
    where.locationId = input.locationId;
  }

  if (input.status) {
    where.status = input.status;
  }

  if (input.from || input.to) {
    where.countDate = {};
    if (input.from) where.countDate.gte = new Date(input.from);
    if (input.to) where.countDate.lte = new Date(input.to);
  }

  const limit = input.limit ?? 50;

  const counts = await tx.physicalCount.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      _count: { select: { lines: true } },
    },
  });

  return counts;
}

export async function addPhysicalCountLines(tx: Tx, input: AddLinesInput) {
  const count = await tx.physicalCount.findFirst({
    where: {
      id: input.countId,
      companyId: input.companyId,
    },
  });

  if (!count) {
    throw new Error("Physical count not found.");
  }

  if (count.status !== CountStatus.DRAFT) {
    throw new Error("Lines can only be added to DRAFT counts.");
  }

  const createdLines = [];
  for (const line of input.lines) {
    // Query the current ledger quantity at this location
    const latest = await tx.stockLedgerEntry.findFirst({
      where: {
        companyId: input.companyId,
        itemId: line.itemId,
        cylinderState: line.cylinderState,
        locationId: count.locationId,
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      select: { balanceAfter: true },
    });

    const ledgerQuantity = latest?.balanceAfter ?? 0;
    const variance = line.countedQuantity - ledgerQuantity;

    const createdLine = await tx.physicalCountLine.create({
      data: {
        physicalCountId: input.countId,
        itemId: line.itemId,
        cylinderState: line.cylinderState,
        ledgerQuantity,
        countedQuantity: line.countedQuantity,
        variance,
        remarks: line.remarks,
      },
    });

    createdLines.push(createdLine);
  }

  // Update status to IN_PROGRESS if currently DRAFT
  if (count.status === CountStatus.DRAFT) {
    await tx.physicalCount.update({
      where: { id: input.countId },
      data: { status: CountStatus.IN_PROGRESS },
    });
  }

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: "UPDATE",
    entityType: "PhysicalCount",
    entityId: count.documentNo,
    after: {
      linesAdded: input.lines.length,
      status: CountStatus.IN_PROGRESS,
    },
  });

  return createdLines;
}

export async function approvePhysicalCount(tx: Tx, input: ApproveCountInput) {
  const count = await tx.physicalCount.findFirst({
    where: {
      id: input.countId,
      companyId: input.companyId,
    },
    include: { lines: true },
  });

  if (!count) {
    throw new Error("Physical count not found.");
  }

  if (count.status !== CountStatus.IN_PROGRESS) {
    throw new Error("Only IN_PROGRESS counts can be approved.");
  }

  if (count.lines.length === 0) {
    throw new Error("Cannot approve a count with no lines.");
  }

  const adjustments: Array<{ itemId: string; cylinderState: CylinderState; variance: number }> = [];

  for (const line of count.lines) {
    if (line.variance === 0) continue;

    const direction = line.variance > 0 ? StockDirection.IN : StockDirection.OUT;
    const absVariance = Math.abs(line.variance);

    await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      direction,
      sourceType: StockSourceType.PHYSICAL_COUNT_ADJUSTMENT,
      sourceId: count.documentNo,
      transactionDate: count.countDate,
      quantity: absVariance,
      createdById: input.userId,
      locationId: count.locationId,
      remarks: `Physical count adjustment: counted ${line.countedQuantity}, ledger ${line.ledgerQuantity}`,
    });

    adjustments.push({
      itemId: line.itemId,
      cylinderState: line.cylinderState,
      variance: line.variance,
    });
  }

  const updated = await tx.physicalCount.update({
    where: { id: input.countId },
    data: {
      status: CountStatus.APPROVED,
      approvedById: input.userId,
      approvedAt: new Date(),
    },
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: "UPDATE",
    entityType: "PhysicalCount",
    entityId: count.documentNo,
    after: {
      status: CountStatus.APPROVED,
      totalLines: count.lines.length,
      adjustmentCount: adjustments.length,
      adjustments: adjustments.map((a) => ({
        itemId: a.itemId,
        cylinderState: a.cylinderState,
        variance: a.variance,
      })),
    },
  });

  return { ...updated, adjustmentCount: adjustments.length };
}
