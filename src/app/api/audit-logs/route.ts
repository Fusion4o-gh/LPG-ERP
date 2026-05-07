import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";
import { readAuditLogs } from "../../../server/services/audit/audit-read.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const logs = await readAuditLogs(context, {
      module: params.get("module") || undefined,
      action: params.get("action") || undefined,
      userId: params.get("userId") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
    });
    return ok({ logs });
  } catch (error) {
    return serviceError(error);
  }
}
