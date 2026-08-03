import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getSaleContractDollarSummaryReport, getSaleContractDollarSummaryReportCsv } from "../../../../server/services/reports/contract-reports.ts";

function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="sale-contract-summary-dollar.csv"' } }); }

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined, customerId: params.get("customerId") ?? undefined, productId: params.get("productId") ?? undefined };
    return params.get("format") === "csv" ? csvResponse(await getSaleContractDollarSummaryReportCsv(context, filters)) : ok(await getSaleContractDollarSummaryReport(context, filters));
  } catch (error) { return serviceError(error); }
}
