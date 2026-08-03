import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getStockTransitReconcileReport, getStockTransitReconcileReportCsv } from "../../../../server/services/reports/transport-reports.ts";

function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="stock-transit-reconcile.csv"' } }); }
export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request); const params = new URL(request.url).searchParams;
    const filters = { to: params.get("to") ?? undefined, productId: params.get("productId") ?? undefined };
    if (params.get("format") === "csv") return csvResponse(await getStockTransitReconcileReportCsv(context, filters));
    return ok(await getStockTransitReconcileReport(context, filters));
  } catch (error) { return serviceError(error); }
}
