import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;
type Context = { companyId: string; financialYearId: string; userId: string };

export async function assertOpeningBalancesUnlocked(tx: Tx, context: Pick<Context, "companyId" | "financialYearId">) {
  const year = await tx.financialYear.findFirst({
    where: { id: context.financialYearId, companyId: context.companyId },
    select: { openingBalancesLockedAt: true },
  });
  if (year?.openingBalancesLockedAt) {
    throw new Error("Opening balances are locked for this financial year.");
  }
}
