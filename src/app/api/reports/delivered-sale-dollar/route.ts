import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getDeliveredSaleDollarReport, getDeliveredSaleDollarReportCsv } from "../../../../server/services/reports/dollar-reports.ts";
function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="delivered-sale-dollar.csv"' } }); }
export async function GET(request: Request) { try { const context = await getRequestContext(request); return new URL(request.url).searchParams.get("format") === "csv" ? csvResponse(await getDeliveredSaleDollarReportCsv(context)) : ok(await getDeliveredSaleDollarReport(context)); } catch (error) { return serviceError(error); } }
