import { CylinderState, PartyType, StockDirection, StockSourceType, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type StockLedgerInput = {
  companyId: string;
  financialYearId: string;
  itemId: string;
  cylinderState: CylinderState;
  direction: StockDirection;
  sourceType: StockSourceType;
  sourceId: string;
  transactionDate: string | Date;
  quantity: number;
  unitCost?: string | number | Prisma.Decimal;
  createdById: string;
  partyType?: PartyType;
  customerId?: string;
  vendorId?: string;
  locationId?: string;
  remarks?: string;
};

export async function createStockLedgerEntry(tx: Tx, input: StockLedgerInput) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Stock ledger quantity must be a positive integer.");
  }

  const previous = await tx.stockLedgerEntry.findFirst({
    where: {
      companyId: input.companyId,
      itemId: input.itemId,
      cylinderState: input.cylinderState,
      locationId: input.locationId ?? null,
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    select: { balanceAfter: true },
  });

  const signedQuantity = input.direction === StockDirection.IN ? input.quantity : -input.quantity;
  const balanceAfter = (previous?.balanceAfter ?? 0) + signedQuantity;

  const company = await tx.company.findUnique({
    where: { id: input.companyId },
    select: { stockAvailableCheck: true },
  });

  if (company?.stockAvailableCheck && balanceAfter < 0) {
    throw new Error("Insufficient stock for this cylinder movement.");
  }

  const unitCost = input.unitCost !== undefined ? new Prisma.Decimal(input.unitCost) : null;

  return tx.stockLedgerEntry.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: input.itemId,
      cylinderState: input.cylinderState,
      unitCost,
      direction: input.direction,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      transactionDate: new Date(input.transactionDate),
      quantity: input.quantity,
      balanceAfter,
      createdById: input.createdById,
      partyType: input.partyType,
      customerId: input.customerId,
      vendorId: input.vendorId,
      locationId: input.locationId ?? null,
      remarks: input.remarks,
    },
  });
}

export async function getWeightedAverageCost(
  tx: Tx,
  companyId: string,
  itemId: string,
  cylinderState: CylinderState,
  locationId?: string | null,
): Promise<Prisma.Decimal> {
  const entries = await tx.stockLedgerEntry.findMany({
    where: {
      companyId,
      itemId,
      cylinderState,
      direction: StockDirection.IN,
      unitCost: { not: null },
      locationId: locationId ?? null,
    },
    select: { quantity: true, unitCost: true },
  });

  if (entries.length === 0) return new Prisma.Decimal(0);

  const totalCost = entries.reduce(
    (sum, e) => sum.plus(new Prisma.Decimal(e.quantity).times(new Prisma.Decimal(e.unitCost!))),
    new Prisma.Decimal(0),
  );
  const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);

  if (totalQty === 0) return new Prisma.Decimal(0);

  return totalCost.dividedBy(totalQty).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function getLastUnitCost(
  tx: Tx,
  companyId: string,
  itemId: string,
  cylinderState: CylinderState,
  locationId?: string | null,
): Promise<Prisma.Decimal | null> {
  const entry = await tx.stockLedgerEntry.findFirst({
    where: {
      companyId,
      itemId,
      cylinderState,
      direction: StockDirection.IN,
      unitCost: { not: null },
      locationId: locationId ?? null,
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    select: { unitCost: true },
  });

  return entry?.unitCost ?? null;
}
