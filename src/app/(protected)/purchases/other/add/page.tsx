import Link from "next/link";
import { PurchaseEmptyOtherForm } from "@/components/PurchaseEmptyOtherForm";
import { purchaseRoutes } from "@/lib/purchase-routes";

export default function PurchaseOtherAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href={purchaseRoutes.other.list} className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Purchase Other
        </Link>
      </div>
      <PurchaseEmptyOtherForm kind="Other" />
    </>
  );
}
