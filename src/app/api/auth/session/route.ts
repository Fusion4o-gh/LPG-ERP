import { getSessionContextFromRequest } from "../../../../server/auth/session.ts";
import { fail, ok } from "../../../../server/api/responses.ts";
import { getUserPermissionKeys } from "../../../../server/services/rbac/permissions.ts";

export async function GET(request: Request) {
  const context = await getSessionContextFromRequest(request);
  if (!context) {
    return fail("Authentication required.", 401, "UNAUTHENTICATED");
  }
  const permissions = await getUserPermissionKeys(context.userId);
  return ok({ context, permissions });
}
