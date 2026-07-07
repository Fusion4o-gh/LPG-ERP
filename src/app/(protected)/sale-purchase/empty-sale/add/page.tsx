import Link from "next/link";
import { EmptySaleForm } from "@/components/EmptySaleForm";

export default function EmptySaleAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/sale-purchase/empty-sale" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Empty Sale LPG
        </Link>
      </div>
      <EmptySaleForm />
    </>
  );
}
