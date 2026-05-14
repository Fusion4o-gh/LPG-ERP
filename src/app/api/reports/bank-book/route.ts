import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getBankBookReport, getBankBookReportCsv } from "../../../../server/services/reports/financial-ledgers.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bank-book.csv"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = {
      bankId: params.get("bankId") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
    };
    if (params.get("format") === "csv") {
      return csvResponse(await getBankBookReportCsv(context, filters));
    }
    const report = await getBankBookReport(context, filters);
    return ok(report);
  } catch (error) {
    return serviceError(error);
  }
}
