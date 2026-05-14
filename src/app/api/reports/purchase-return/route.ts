import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { getPurchaseReturnReport, getPurchaseReturnReportCsv } from "../../../../server/services/reports/purchase-reports.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="purchase-return.csv"' },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      vendorId: params.get("vendorId") ?? undefined,
      itemId: params.get("itemId") ?? undefined,
    };
    if (params.get("format") === "csv") return csvResponse(await getPurchaseReturnReportCsv(context, filters));
    const rows = await getPurchaseReturnReport(context, filters);
    return ok({ rows });
  } catch (error) {
    return serviceError(error);
  }
}
