import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { getSalewiseProfitReport, getSalewiseProfitReportCsv } from "../../../../server/services/reports/sales-reports.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="salewise-profit.csv"' },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      itemId: params.get("itemId") ?? undefined,
      customerId: params.get("customerId") ?? undefined,
    };
    if (params.get("format") === "csv") return csvResponse(await getSalewiseProfitReportCsv(context, filters));
    const report = await getSalewiseProfitReport(context, filters);
    return ok(report);
  } catch (error) {
    return serviceError(error);
  }
}
