import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getCustomerCylinderBalanceReport, getCustomerCylinderBalanceReportCsv } from "../../../../server/services/reports/operational-reports.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="customer-cylinder-balances.csv"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = {
      customerId: params.get("customerId") ?? undefined,
      itemId: params.get("itemId") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    };
    if (params.get("format") === "csv") {
      return csvResponse(await getCustomerCylinderBalanceReportCsv(context, filters));
    }
    const rows = await getCustomerCylinderBalanceReport(context, filters);
    return ok({ rows });
  } catch (error) {
    return serviceError(error);
  }
}
