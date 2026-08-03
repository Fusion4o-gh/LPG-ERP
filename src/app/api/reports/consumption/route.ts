import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getConsumptionReport, getConsumptionReportCsv } from "../../../../server/services/reports/bulk-reports.ts";

function csvResponse(csv: string) {
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="consumption-report.csv"' } });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined, productId: params.get("productId") ?? undefined, locationId: params.get("locationId") ?? undefined, inTransit: params.get("inTransit") ?? undefined };
    if (params.get("format") === "csv") return csvResponse(await getConsumptionReportCsv(context, filters));
    return ok(await getConsumptionReport(context, filters));
  } catch (error) {
    return serviceError(error);
  }
}
