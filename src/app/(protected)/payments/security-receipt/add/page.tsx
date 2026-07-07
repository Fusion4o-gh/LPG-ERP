import Link from "next/link";
import { SecurityReceiptForm } from "@/components/SecurityReceiptForm";

export default function SecurityReceiptAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/payments/security-receipt" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Security Receipt
        </Link>
      </div>
      <SecurityReceiptForm />
    </>
  );
}
