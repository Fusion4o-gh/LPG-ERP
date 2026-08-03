import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getExecutiveSummaryReport, getExecutiveSummaryReportCsv } from "../../../../server/services/reports/accounting-reports.ts";
function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="executive-summary.csv"' } }); }
export async function GET(request: Request) { try { const context = await getRequestContext(request); const p = new URL(request.url).searchParams; const filters = { from: p.get("from") ?? undefined, to: p.get("to") ?? undefined }; return p.get("format") === "csv" ? csvResponse(await getExecutiveSummaryReportCsv(context, filters)) : ok(await getExecutiveSummaryReport(context, filters)); } catch (error) { return serviceError(error); } }
