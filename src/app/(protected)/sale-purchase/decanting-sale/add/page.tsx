import Link from "next/link";
import { DecantingSaleForm } from "@/components/DecantingSaleForm";

export default function DecantingSaleAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/sale-purchase/decanting-sale" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Decanting
        </Link>
      </div>
      <DecantingSaleForm />
    </>
  );
}
