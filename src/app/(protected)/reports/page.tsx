import { redirect } from "next/navigation";
import { getSessionContextFromCookies } from "@/server/auth/session-cookies";
import { firstPermittedReportHref } from "@/lib/navigation/modules";
import { getUserPermissionKeys } from "@/server/services/rbac/permissions";

export default async function ReportsIndexPage() {
  const context = await getSessionContextFromCookies();
  if (!context) {
    redirect("/login");
  }
  const permissions = await getUserPermissionKeys(context.userId);
  redirect(firstPermittedReportHref(permissions));
}
