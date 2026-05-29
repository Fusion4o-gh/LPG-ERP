import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getDailyActivityReport, getDailyActivityReportCsv } from "../../../../server/services/reports/operational-reports.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="daily-activity.csv"',
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
    };
    if (params.get("format") === "csv") {
      return csvResponse(await getDailyActivityReportCsv(context, filters));
    }
    const report = await getDailyActivityReport(context, filters);
    return ok(report);
  } catch (error) {
    return serviceError(error);
  }
}
