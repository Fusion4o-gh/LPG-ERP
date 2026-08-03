import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";
import { getBackupSchedule, listBackups, triggerBackup, updateBackupSchedule } from "../../../server/services/backup/database-backup.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const [backups, schedule] = await Promise.all([listBackups(context), getBackupSchedule(context)]);
    return ok({ backups, schedule });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = (await request.json()) as { enabled?: boolean; frequency?: string; time?: string; day?: number; retentionDays?: number };
    return ok({ schedule: await updateBackupSchedule(context, body) });
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
