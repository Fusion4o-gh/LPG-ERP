import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId") ?? undefined;
    const itemId = url.searchParams.get("itemId") ?? undefined;
    const balances = await prisma.customerCylinderBalance.findMany({
      where: { customerId, itemId, customer: { companyId: context.companyId } },
      include: {
        customer: { select: { code: true, name: true } },
        item: { select: { code: true, name: true } },
      },
      orderBy: [{ customer: { name: "asc" } }, { item: { code: "asc" } }],
      take: 300,
    });

    const rows = await Promise.all(
      balances.map(async (balance) => {
        const lastMovement = await prisma.stockLedgerEntry.findFirst({
          where: { companyId: context.companyId, financialYearId: context.financialYearId, customerId: balance.customerId, itemId: balance.itemId },
          orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
          select: { transactionDate: true },
        });
        return {
          id: balance.id,
          customer: balance.customer,
          item: balance.item,
          filledOutstanding: balance.filledOutstanding,
          emptyOwed: balance.emptyOwed,
          securityHeld: balance.securityHeld,
          lastMovementDate: lastMovement?.transactionDate ?? null,
        };
      }),
    );

    return ok({ balances: rows });
  } catch (error) {
    return serviceError(error);
  }
}
