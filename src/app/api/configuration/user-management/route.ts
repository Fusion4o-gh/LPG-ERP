import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { createUser, listRolesForUsers, listUsers } from "../../../../server/services/user-management/user-management.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const [users, roles] = await Promise.all([listUsers(context), listRolesForUsers(context)]);
    return ok({ users, roles });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const roleIds = Array.isArray(body.roleIds) ? (body.roleIds as string[]) : [];
    const user = await createUser(context, {
      loginId: stringField(body, "loginId"),
      name: stringField(body, "name"),
      password: stringField(body, "password"),
      email: optionalStringField(body, "email"),
      status: optionalStringField(body, "status"),
      roleIds,
    });
    return ok({ user });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
