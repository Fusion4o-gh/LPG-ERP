import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { runDueBackup } from "../../../../server/services/backup/database-backup.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    return ok(await runDueBackup(context));
  } catch (error) {
    return serviceError(error);
  }
}
