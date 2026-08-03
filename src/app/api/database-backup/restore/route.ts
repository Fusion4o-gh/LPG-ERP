import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { restoreBackup } from "../../../../server/services/backup/database-backup.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const result = await restoreBackup(context, stringField(body, "filename"), optionalStringField(body, "confirmation") ?? "");
    return ok({ result });
  } catch (error) {
    return error instanceof Error && /filename|confirm/i.test(error.message) ? fail(error.message) : serviceError(error);
  }
}
