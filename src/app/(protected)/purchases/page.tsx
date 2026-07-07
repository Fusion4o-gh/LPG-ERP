import Link from "next/link";
import { redirect } from "next/navigation";
import { purchaseRoutes } from "@/lib/purchase-routes";
import { canAccess } from "@/lib/permissions";
import { getSessionContextFromCookies } from "@/server/auth/session-cookies";
import { getUserPermissionKeys } from "@/server/services/rbac/permissions";

export default async function PurchasesPage() {
  const context = await getSessionContextFromCookies();
  if (!context) redirect("/login");
  const permissions = await getUserPermissionKeys(context.userId);
  if (!canAccess(permissions, "purchase-filled-cylinders", "VIEW")) redirect("/dashboard");

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gas-800">Purchases</h1>
        <p className="mt-1 text-sm text-steel-500">Create and manage LPG purchases</p>
      </div>

      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Link
          href={purchaseRoutes.filled.add}
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold text-white"
            style={{ background: "var(--flame-gradient)", boxShadow: "var(--skeu-shadow-sm)" }}
          >
            +
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">New Filled Purchase</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Record a filled-cylinder GIRN from a vendor</p>
          </div>
        </Link>

        <Link
          href={purchaseRoutes.empty.list}
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold"
            style={{ background: "var(--skeu-raised)", boxShadow: "var(--skeu-shadow-sm)", color: "var(--gas-blue)" }}
          >
            E
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">Purchase Empty</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Receive empty cylinders from vendors</p>
          </div>
        </Link>

        <Link
          href={purchaseRoutes.other.list}
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold"
            style={{ background: "var(--skeu-raised)", boxShadow: "var(--skeu-shadow-sm)", color: "var(--gas-blue)" }}
          >
            O
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">Purchase Other</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Record non-cylinder purchases</p>
          </div>
        </Link>

        <Link
          href={purchaseRoutes.returnCylinder.list}
          className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all hover:brightness-95"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold"
            style={{ background: "var(--skeu-raised)", boxShadow: "var(--skeu-shadow-sm)", color: "var(--gas-blue)" }}
          >
            R
          </span>
          <div>
            <p className="text-sm font-bold text-gas-800">Purchase Return</p>
            <p className="mt-1 text-xs leading-5 text-steel-500">Return cylinders or other items to vendors</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
