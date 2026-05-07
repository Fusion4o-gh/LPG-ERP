import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getUserPermissionKeys } from "../../../../server/services/rbac/permissions.ts";
import { listPermissions } from "../../../../server/services/rbac/role-management.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const [permissions, currentUserPermissions] = await Promise.all([listPermissions(context), getUserPermissionKeys(context.userId)]);
    return ok({ permissions, currentUserPermissions });
  } catch (error) {
    return serviceError(error);
  }
}
