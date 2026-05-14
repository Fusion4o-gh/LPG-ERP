import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getGeneralLedgerReport, getGeneralLedgerReportCsv } from "../../../../server/services/reports/financial-ledgers.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="general-ledger.csv"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const accountId = params.get("accountId") ?? undefined;
    if (!accountId) return fail("accountId is required.");
    const filters = {
      accountId,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    };
    if (params.get("format") === "csv") {
      return csvResponse(await getGeneralLedgerReportCsv(context, filters));
    }
    const report = await getGeneralLedgerReport(context, filters);
    return ok(report);
  } catch (error) {
    return serviceError(error);
  }
}
