import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";
import { listBackups, triggerBackup } from "../../../server/services/backup/database-backup.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const backups = await listBackups(context);
    return ok({ backups });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = (await request.json().catch(() => ({}))) as { backupDate?: string };
    const result = await triggerBackup(context, typeof body.backupDate === "string" ? body.backupDate : undefined);
    return ok({ result });
  } catch (error) {
    return serviceError(error);
  }
}
