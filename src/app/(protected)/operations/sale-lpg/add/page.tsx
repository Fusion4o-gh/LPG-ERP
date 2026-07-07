import Link from "next/link";
import { SaleLpgForm } from "@/components/SaleLpgForm";

export default function SaleLpgAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/operations/sale-lpg" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Sale LPG
        </Link>
      </div>
      <SaleLpgForm />
    </>
  );
}
