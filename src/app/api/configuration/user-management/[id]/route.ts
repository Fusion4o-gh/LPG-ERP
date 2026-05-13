import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { optionalStringField, readJson } from "../../../../../server/api/validation.ts";
import { updateUser } from "../../../../../server/services/user-management/user-management.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const roleIds = Array.isArray(body.roleIds) ? (body.roleIds as string[]) : undefined;
    const user = await updateUser(context, id, {
      loginId: optionalStringField(body, "loginId"),
      name: optionalStringField(body, "name"),
      email: optionalStringField(body, "email"),
      status: optionalStringField(body, "status"),
      roleIds,
    });
    return ok({ user });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
