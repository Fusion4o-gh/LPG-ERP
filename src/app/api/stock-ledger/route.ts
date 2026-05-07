import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const itemId = url.searchParams.get("itemId") ?? undefined;
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const entries = await prisma.stockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        itemId,
        transactionDate: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      include: { item: { select: { code: true, name: true } }, customer: { select: { code: true, name: true } }, vendor: { select: { code: true, name: true } } },
      take: 300,
    });
    return ok({
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.transactionDate,
        item: entry.item,
        cylinderState: entry.cylinderState,
        direction: entry.direction,
        quantity: entry.quantity,
        balanceAfter: entry.balanceAfter,
        sourceType: entry.sourceType,
        sourceDocumentNo: entry.sourceId,
        party: entry.customer ?? entry.vendor ?? null,
      })),
    });
  } catch (error) {
    return serviceError(error);
  }
}
