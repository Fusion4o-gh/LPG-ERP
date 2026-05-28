import { AppShell } from "@/components/AppShell";
import { redirect } from "next/navigation";
import { getAppShellContext } from "@/server/auth/app-shell-context";
import { getSessionContextFromCookies } from "@/server/auth/session-cookies";
import { getUserPermissionKeys } from "@/server/services/rbac/permissions";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getSessionContextFromCookies();
  if (!context) {
    redirect("/login");
  }
  const [permissions, shell] = await Promise.all([
    getUserPermissionKeys(context.userId),
    getAppShellContext(context.userId, context.financialYearId),
  ]);
  return (
    <AppShell permissions={permissions} shell={shell}>
      {children}
    </AppShell>
  );
}
