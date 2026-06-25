import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getStockByLocation } from "../../../../server/services/reports/stock-by-location.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId") ?? undefined;

    const rows = await prisma.$transaction((tx) =>
      getStockByLocation(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        locationId,
      }),
    );

    return ok({ rows });
  } catch (error) {
    return serviceError(error);
  }
}
