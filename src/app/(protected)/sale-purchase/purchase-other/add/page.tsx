import Link from "next/link";
import { PurchaseEmptyOtherForm } from "@/components/PurchaseEmptyOtherForm";

export default function PurchaseOtherAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/sale-purchase/purchase-other" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Purchase Other
        </Link>
      </div>
      <PurchaseEmptyOtherForm kind="Other" />
    </>
  );
}
