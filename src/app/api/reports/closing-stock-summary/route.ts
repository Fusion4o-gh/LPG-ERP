import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getClosingStockSummaryReport, getClosingStockSummaryReportCsv } from "../../../../server/services/reports/operational-reports.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="closing-stock-summary.csv"' },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = { itemId: params.get("itemId") ?? undefined, from: params.get("from") ?? undefined, to: params.get("to") ?? undefined };
    if (params.get("format") === "csv") return csvResponse(await getClosingStockSummaryReportCsv(context, filters));
    return ok(await getClosingStockSummaryReport(context, filters));
  } catch (error) {
    return serviceError(error);
  }
}
