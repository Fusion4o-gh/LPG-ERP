import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getTrialBalanceReport, getTrialBalanceReportCsv } from "../../../../server/services/reports/financial-ledgers.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="trial-balance.csv"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      accountType: params.get("accountType") ?? undefined,
    };
    if (params.get("format") === "csv") {
      return csvResponse(await getTrialBalanceReportCsv(context, filters));
    }
    const report = await getTrialBalanceReport(context, filters);
    return ok(report);
  } catch (error) {
    return serviceError(error);
  }
}
