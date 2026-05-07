import { PageHeader } from "@/components/PageHeader";
import { canAccess } from "@/lib/permissions";
import { getSessionContextFromCookies } from "@/server/auth/session-cookies";
import { getUserPermissionKeys } from "@/server/services/rbac/permissions";
import { RoleManagementClient } from "./RoleManagementClient";

export default async function RolesPage() {
  const context = await getSessionContextFromCookies();
  const permissions = context ? await getUserPermissionKeys(context.userId) : [];
  const canManage = canAccess(permissions, "rbac", "MANAGE_RBAC");

  return (
    <>
      <PageHeader title="Roles & Permissions" description="Manage operational access for LPG ERP users." />
      <RoleManagementClient canManage={canManage} />
    </>
  );
}
