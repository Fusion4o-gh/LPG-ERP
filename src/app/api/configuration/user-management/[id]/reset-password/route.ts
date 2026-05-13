import { fail, ok, serviceError } from "../../../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { readJson, stringField } from "../../../../../../server/api/validation.ts";
import { resetUserPassword } from "../../../../../../server/services/user-management/user-management.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const result = await resetUserPassword(context, id, stringField(body, "password"));
    return ok(result);
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
