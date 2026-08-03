import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getLicenseDetailReport, getLicenseDetailReportCsv } from "../../../../server/services/reports/specialized-reports.ts";
function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="license-detail.csv"' } }); }
export async function GET(request: Request) { try { const context = await getRequestContext(request); const p = new URL(request.url).searchParams; const filters = { from: p.get("from") ?? undefined, to: p.get("to") ?? undefined, driverId: p.get("driverId") ?? undefined }; return p.get("format") === "csv" ? csvResponse(await getLicenseDetailReportCsv(context, filters)) : ok(await getLicenseDetailReport(context, filters)); } catch (error) { return serviceError(error); } }
