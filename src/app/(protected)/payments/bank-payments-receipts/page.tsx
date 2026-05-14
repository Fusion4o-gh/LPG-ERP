import { redirect } from "next/navigation";
import { canAccess } from "@/lib/permissions";
import { getSessionContextFromCookies } from "@/server/auth/session-cookies";
import { getUserPermissionKeys } from "@/server/services/rbac/permissions";
import { BankPaymentsReceiptsClient } from "@/components/BankPaymentsReceiptsClient";

export default async function BankPaymentsReceiptsPage() {
  const context = await getSessionContextFromCookies();
  const permissions = context ? await getUserPermissionKeys(context.userId) : [];
  if (!canAccess(permissions, "bank-payments")) {
    redirect("/dashboard");
  }
  return <BankPaymentsReceiptsClient />;
}
