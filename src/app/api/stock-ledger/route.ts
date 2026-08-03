import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stock-ledger.csv"',
    },
  });
}

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
    const result = entries.map((entry) => ({
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
      }));
    if (url.searchParams.get("format") === "csv") {
      const lines = [
        ["Date", "Item Code", "Item", "Cylinder State", "Direction", "Quantity", "Balance After", "Source Type", "Source Document", "Party"],
        ...result.map((entry) => [
          new Date(entry.date).toISOString().slice(0, 10),
          entry.item.code,
          entry.item.name,
          entry.cylinderState,
          entry.direction,
          entry.quantity,
          entry.balanceAfter,
          entry.sourceType,
          entry.sourceDocumentNo,
          entry.party ? `${entry.party.code ?? ""} ${entry.party.name ?? ""}`.trim() : "",
        ]),
      ];
      return csvResponse(lines.map((line) => line.map(csvCell).join(",")).join("\n"));
    }
    return ok({ entries: result });
  } catch (error) {
    return serviceError(error);
  }
}
