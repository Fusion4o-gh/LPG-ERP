import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getPartialSaleStatusReport, getPartialSaleStatusReportCsv } from "../../../../server/services/reports/specialized-reports.ts";

function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="partial-sale-status.csv"' } }); }
export async function GET(request: Request) {
  try { const context = await getRequestContext(request); const params = new URL(request.url).searchParams; const filters = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined, productId: params.get("productId") ?? undefined, locationId: params.get("locationId") ?? undefined, status: params.get("status") ?? undefined }; if (params.get("format") === "csv") return csvResponse(await getPartialSaleStatusReportCsv(context, filters)); return ok(await getPartialSaleStatusReport(context, filters)); } catch (error) { return serviceError(error); }
}
