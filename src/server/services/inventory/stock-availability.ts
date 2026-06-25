import { CylinderState, StockDirection, type Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function getFilledStockByItem(
  tx: Tx,
  input: { companyId: string; financialYearId: string; itemIds: string[]; locationId?: string },
) {
  const map = new Map<string, number>();
  for (const itemId of input.itemIds) {
    map.set(itemId, 0);
  }
  if (input.itemIds.length === 0) return map;

  const rows = await tx.stockLedgerEntry.groupBy({
    by: ["itemId", "direction"],
    where: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: { in: input.itemIds },
      cylinderState: CylinderState.FILLED,
      locationId: input.locationId,
    },
    _sum: { quantity: true },
  });

  for (const row of rows) {
    const signed = (row.direction === StockDirection.IN ? 1 : -1) * (row._sum.quantity ?? 0);
    map.set(row.itemId, (map.get(row.itemId) ?? 0) + signed);
  }
  return map;
}

export async function assertFilledStockAvailable(
  tx: Tx,
  input: { companyId: string; financialYearId: string; locationId?: string; lines: { itemId: string; quantity: number; itemLabel?: string }[] },
) {
  const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
  const stock = await getFilledStockByItem(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    itemIds,
    locationId: input.locationId,
  });

  for (const line of input.lines) {
    const available = stock.get(line.itemId) ?? 0;
    if (line.quantity > available) {
      const label = line.itemLabel ?? line.itemId;
      throw new Error(`Insufficient filled stock for ${label}. Available: ${available}, requested: ${line.quantity}.`);
    }
  }
}
