import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getDebtorsAgeingReport, getDebtorsAgeingReportCsv } from "../../../../server/services/reports/financial-ledgers.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="debtors-ageing.csv"' },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = { asOf: params.get("asOf") ?? params.get("to") ?? undefined };
    if (params.get("format") === "csv") return csvResponse(await getDebtorsAgeingReportCsv(context, filters));
    return ok(await getDebtorsAgeingReport(context, filters));
  } catch (error) {
    return serviceError(error);
  }
}
