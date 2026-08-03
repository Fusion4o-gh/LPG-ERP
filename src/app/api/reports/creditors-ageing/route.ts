import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getCreditorsAgeingReport, getCreditorsAgeingReportCsv } from "../../../../server/services/reports/financial-ledgers.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="creditors-ageing.csv"' },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = { asOf: params.get("asOf") ?? params.get("to") ?? undefined };
    if (params.get("format") === "csv") return csvResponse(await getCreditorsAgeingReportCsv(context, filters));
    return ok(await getCreditorsAgeingReport(context, filters));
  } catch (error) {
    return serviceError(error);
  }
}
