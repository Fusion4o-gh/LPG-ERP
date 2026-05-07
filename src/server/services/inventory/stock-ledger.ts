import { CylinderState, PartyType, StockDirection, StockSourceType, type Prisma } from "@prisma/client";

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
  createdById: string;
  partyType?: PartyType;
  customerId?: string;
  vendorId?: string;
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

  return tx.stockLedgerEntry.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: input.itemId,
      cylinderState: input.cylinderState,
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
      remarks: input.remarks,
    },
  });
}
