import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getRetailSaleRegisterReport, getRetailSaleRegisterReportCsv } from "../../../../server/services/reports/transport-reports.ts";

function csvResponse(csv: string) { return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="retail-sale-register.csv"' } }); }
export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request); const params = new URL(request.url).searchParams;
    const filters = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined, productId: params.get("productId") ?? undefined, customerId: params.get("customerId") ?? undefined, vehicleId: params.get("vehicleId") ?? undefined, transporterId: params.get("transporterId") ?? undefined };
    if (params.get("format") === "csv") return csvResponse(await getRetailSaleRegisterReportCsv(context, filters));
    return ok(await getRetailSaleRegisterReport(context, filters));
  } catch (error) { return serviceError(error); }
}
