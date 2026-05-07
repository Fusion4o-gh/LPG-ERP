import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getBalanceSheetReport, getBalanceSheetReportCsv } from "../../../../server/services/reports/financial-ledgers.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="balance-sheet.csv"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = {
      asOf: params.get("asOf") ?? undefined,
    };
    if (params.get("format") === "csv") {
      return csvResponse(await getBalanceSheetReportCsv(context, filters));
    }
    const report = await getBalanceSheetReport(context, filters);
    return ok(report);
  } catch (error) {
    return serviceError(error);
  }
}
