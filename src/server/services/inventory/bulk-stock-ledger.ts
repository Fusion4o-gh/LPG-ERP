import { BulkStockSourceType, PartyType, Prisma, StockDirection, UnitOfMeasure } from "@prisma/client";

type Tx = Prisma.TransactionClient;

type BulkStockLedgerInput = {
  companyId: string;
  financialYearId: string;
  productId: string;
  locationId: string;
  plantId?: string | null;
  direction: StockDirection;
  quantity: string | number | Prisma.Decimal;
  unit?: UnitOfMeasure;
  inTransit?: boolean;
  sourceType: BulkStockSourceType;
  sourceId: string;
  transactionDate: string | Date;
  createdById: string;
  partyType?: PartyType;
  customerId?: string | null;
  vendorId?: string | null;
  remarks?: string;
  /** When true, skip the negative-stock guard (e.g. loss adjustments). */
  allowNegative?: boolean;
};

/**
 * Immutable bulk LPG stock movement. Mirrors the cylinder StockLedgerEntry
 * engine but uses decimal quantities and a location/plant + in-transit
 * dimension. balanceAfter is the on-hand (non-transit) balance per
 * product+location; in-transit movements keep their own running balance.
 */
export async function createBulkStockLedgerEntry(tx: Tx, input: BulkStockLedgerInput) {
  const quantity = new Prisma.Decimal(input.quantity);
  if (quantity.lte(0)) {
    throw new Error("Bulk stock quantity must be a positive number.");
  }

  const inTransit = input.inTransit ?? false;

  const previous = await tx.bulkStockLedgerEntry.findFirst({
    where: {
      companyId: input.companyId,
      productId: input.productId,
      locationId: input.locationId,
      inTransit,
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    select: { balanceAfter: true },
  });

  const signed = input.direction === StockDirection.IN ? quantity : quantity.negated();
  const balanceAfter = new Prisma.Decimal(previous?.balanceAfter ?? 0).plus(signed);

  if (!input.allowNegative && balanceAfter.isNegative()) {
    const company = await tx.company.findUnique({ where: { id: input.companyId }, select: { stockAvailableCheck: true } });
    if (company?.stockAvailableCheck) {
      throw new Error("Insufficient bulk stock for this movement at the selected location.");
    }
  }

  return tx.bulkStockLedgerEntry.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      productId: input.productId,
      locationId: input.locationId,
      plantId: input.plantId ?? null,
      direction: input.direction,
      quantity,
      unit: input.unit ?? UnitOfMeasure.MT,
      balanceAfter,
      inTransit,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      transactionDate: new Date(input.transactionDate),
      createdById: input.createdById,
      partyType: input.partyType,
      customerId: input.customerId ?? null,
      vendorId: input.vendorId ?? null,
      remarks: input.remarks,
    },
  });
}

/** Current on-hand (non-transit) balance for a product at a location. */
export async function getBulkOnHand(tx: Tx, companyId: string, productId: string, locationId: string) {
  const last = await tx.bulkStockLedgerEntry.findFirst({
    where: { companyId, productId, locationId, inTransit: false },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    select: { balanceAfter: true },
  });
  return new Prisma.Decimal(last?.balanceAfter ?? 0);
}
