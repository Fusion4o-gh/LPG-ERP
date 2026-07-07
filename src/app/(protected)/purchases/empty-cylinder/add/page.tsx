import Link from "next/link";
import { PurchaseEmptyOtherForm } from "@/components/PurchaseEmptyOtherForm";
import { purchaseRoutes } from "@/lib/purchase-routes";

export default function PurchaseEmptyCylinderAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href={purchaseRoutes.empty.list} className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Purchase Empty
        </Link>
      </div>
      <PurchaseEmptyOtherForm kind="EmptyCylinder" />
    </>
  );
}
