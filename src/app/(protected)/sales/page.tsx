import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContextFromCookies } from "@/server/auth/session-cookies";
import { getUserPermissionKeys } from "@/server/services/rbac/permissions";
import { canAccess } from "@/lib/permissions";

export default async function SalesPage() {
  const context = await getSessionContextFromCookies();
  if (!context) redirect("/login");
  const permissions = await getUserPermissionKeys(context.userId);
  if (!canAccess(permissions, "sale-lpg", "VIEW")) redirect("/dashboard");

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gas-800">Sales</h1>
        <p className="mt-1 text-sm text-steel-500">Create and manage LPG sales</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
        <Link
          href="/operations/sale-lpg/add"
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold text-white" style={{ background: 'var(--flame-gradient)', boxShadow: 'var(--skeu-shadow-sm)' }}>
            +
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">New LPG Sale</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Record a retail LPG cylinder sale to a customer</p>
          </div>
        </Link>

        <Link
          href="/operations/complete-day-sale"
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold" style={{ background: 'var(--skeu-raised)', boxShadow: 'var(--skeu-shadow-sm)', color: 'var(--gas-blue)' }}>
            D
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">Complete Day Sale</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Batch close all today&apos;s LPG sales</p>
          </div>
        </Link>

        <Link
          href="/sale-purchase/empty-sale"
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold" style={{ background: 'var(--skeu-raised)', boxShadow: 'var(--skeu-shadow-sm)', color: 'var(--gas-blue)' }}>
            E
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">Empty Sale</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Sell empty cylinders to customers</p>
          </div>
        </Link>

        <Link
          href="/sale-purchase/decanting-sale"
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold" style={{ background: 'var(--skeu-raised)', boxShadow: 'var(--skeu-shadow-sm)', color: 'var(--gas-blue)' }}>
            DC
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">Decanting Sale</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Record decanted LPG cylinder sales</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
