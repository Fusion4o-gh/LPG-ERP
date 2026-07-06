import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** When a user has map-area assignments, restrict customer lookups to those areas. */
export async function customerAreaFilter(tx: Tx, userId: string): Promise<Prisma.CustomerWhereInput | undefined> {
  const areaIds = (
    await tx.userArea.findMany({
      where: { userId },
      select: { areaId: true },
    })
  ).map((row) => row.areaId);

  if (areaIds.length === 0) return undefined;
  return { areaId: { in: areaIds } };
}
