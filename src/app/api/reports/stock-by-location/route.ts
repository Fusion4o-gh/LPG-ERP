import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getStockByLocation, getStockByLocationCsv } from "../../../../server/services/reports/stock-by-location.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stock-by-location.csv"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId") ?? undefined;

    const input = {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        locationId,
      };
    if (url.searchParams.get("format") === "csv") {
      return prisma.$transaction((tx) => getStockByLocationCsv(tx, input)).then(csvResponse);
    }
    const rows = await prisma.$transaction((tx) => getStockByLocation(tx, input));

    return ok({ rows });
  } catch (error) {
    return serviceError(error);
  }
}
