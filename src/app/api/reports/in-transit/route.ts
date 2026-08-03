import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getLoadingReport, getLoadingReportCsv } from "../../../../server/services/reports/bulk-reports.ts";
function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="in-transit-report.csv"' } }); }
export async function GET(request: Request) { try { const context = await getRequestContext(request); return new URL(request.url).searchParams.get("format") === "csv" ? csvResponse(await getLoadingReportCsv(context, true)) : ok(await getLoadingReport(context, true)); } catch (error) { return serviceError(error); } }
