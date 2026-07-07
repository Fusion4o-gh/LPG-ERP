import Link from "next/link";
import { PurchaseFilledCylinderForm } from "@/components/PurchaseFilledCylinderForm";

export default function PurchaseFilledCylinderAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/operations/purchase-filled-cylinder" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Purchase Filled
        </Link>
      </div>
      <PurchaseFilledCylinderForm />
    </>
  );
}
