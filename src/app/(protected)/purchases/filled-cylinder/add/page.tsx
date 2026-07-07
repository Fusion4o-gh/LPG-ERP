import Link from "next/link";
import { PurchaseFilledCylinderForm } from "@/components/PurchaseFilledCylinderForm";
import { purchaseRoutes } from "@/lib/purchase-routes";

export default function PurchaseFilledCylinderAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href={purchaseRoutes.filled.list} className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Purchase Filled
        </Link>
      </div>
      <PurchaseFilledCylinderForm />
    </>
  );
}
