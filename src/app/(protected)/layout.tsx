import { AppShell } from "@/components/AppShell";
import { redirect } from "next/navigation";
import { getSessionContextFromCookies } from "@/server/auth/session-cookies";
import { getUserPermissionKeys } from "@/server/services/rbac/permissions";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getSessionContextFromCookies();
  if (!context) {
    redirect("/login");
  }
  const permissions = await getUserPermissionKeys(context.userId);
  return <AppShell permissions={permissions}>{children}</AppShell>;
}
