import { CylinderState, StockDirection, type Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type StockByLocationInput = {
  companyId: string;
  financialYearId: string;
  locationId?: string;
};

export type StockByLocationRow = {
  locationId: string;
  locationCode: string;
  locationName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  filledQuantity: number;
  emptyQuantity: number;
};

export async function getStockByLocation(tx: Tx, input: StockByLocationInput): Promise<StockByLocationRow[]> {
  // Get all stock ledger entries for this company/financial year, grouped by location+item+state+direction
  const rows = await tx.stockLedgerEntry.groupBy({
    by: ["locationId", "itemId", "cylinderState", "direction"],
    where: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      locationId: input.locationId ?? undefined,
    },
    _sum: { quantity: true },
  });

  // Compute net quantity per (locationId, itemId, cylinderState)
  // Net = sum(IN) - sum(OUT)
  const netMap = new Map<string, { filled: number; empty: number }>();

  for (const row of rows) {
    const key = `${row.locationId ?? "__null__"}::${row.itemId}`;
    if (!netMap.has(key)) {
      netMap.set(key, { filled: 0, empty: 0 });
    }
    const entry = netMap.get(key)!;
    const signed = (row.direction === StockDirection.IN ? 1 : -1) * (row._sum.quantity ?? 0);

    if (row.cylinderState === CylinderState.FILLED) {
      entry.filled += signed;
    } else {
      entry.empty += signed;
    }
  }

  if (netMap.size === 0) return [];

  // Collect unique locationIds and itemIds for name resolution
  const locationIds = new Set<string>();
  const itemIds = new Set<string>();
  const nullLocationKeys: string[] = [];

  for (const key of netMap.keys()) {
    const [locId, itemId] = key.split("::");
    if (locId === "__null__") {
      nullLocationKeys.push(key);
    } else {
      locationIds.add(locId);
    }
    itemIds.add(itemId);
  }

  // Fetch location and item names
  const [locations, items] = await Promise.all([
    locationIds.size > 0
      ? tx.stockLocation.findMany({
          where: { id: { in: [...locationIds] } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([] as Array<{ id: string; code: string; name: string }>),
    tx.item.findMany({
      where: { id: { in: [...itemIds] } },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const locationById = new Map(locations.map((l) => [l.id, l]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  const result: StockByLocationRow[] = [];

  for (const [key, quantities] of netMap.entries()) {
    const [locId, itemId] = key.split("::");
    const item = itemById.get(itemId);

    if (locId === "__null__") {
      result.push({
        locationId: "",
        locationCode: "\u2014",
        locationName: "Unassigned",
        itemId,
        itemCode: item?.code ?? itemId,
        itemName: item?.name ?? "",
        filledQuantity: Math.max(0, quantities.filled),
        emptyQuantity: Math.max(0, quantities.empty),
      });
    } else {
      const loc = locationById.get(locId);
      result.push({
        locationId: locId,
        locationCode: loc?.code ?? locId,
        locationName: loc?.name ?? "",
        itemId,
        itemCode: item?.code ?? itemId,
        itemName: item?.name ?? "",
        filledQuantity: Math.max(0, quantities.filled),
        emptyQuantity: Math.max(0, quantities.empty),
      });
    }
  }

  // Sort by location code then item code
  result.sort((a, b) => {
    const locCmp = a.locationCode.localeCompare(b.locationCode);
    if (locCmp !== 0) return locCmp;
    return a.itemCode.localeCompare(b.itemCode);
  });

  return result;
}
