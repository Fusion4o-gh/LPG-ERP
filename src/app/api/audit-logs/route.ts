import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";
import { readAuditLogs, readAuditLogsCsv } from "../../../server/services/audit/audit-read.ts";

function csvResponse(csv: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-log.csv"',
    },
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const filters = {
      module: params.get("module") || undefined,
      action: params.get("action") || undefined,
      userId: params.get("userId") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    };
    if (params.get("format") === "csv") return csvResponse(await readAuditLogsCsv(context, filters));
    const logs = await readAuditLogs(context, filters);
    return ok({ logs });
  } catch (error) {
    return serviceError(error);
  }
}
