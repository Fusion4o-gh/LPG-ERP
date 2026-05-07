import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { createRole, listAssignableUsers, listRoles } from "../../../../server/services/rbac/role-management.ts";

function stringArray(value: unknown, name: string) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${name} must be an array of strings.`);
  }
  return value as string[];
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const [roles, users] = await Promise.all([listRoles(context), listAssignableUsers(context)]);
    return ok({ roles, users });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const role = await createRole(context, {
      name: stringField(body, "name"),
      description: optionalStringField(body, "description"),
      status: optionalStringField(body, "status") as never,
      permissionIds: stringArray(body.permissionIds, "permissionIds"),
      userIds: stringArray(body.userIds, "userIds"),
    });
    return ok({ role });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
