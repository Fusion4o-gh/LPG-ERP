import Link from "next/link";
import { CylinderReturnForm } from "@/components/CylinderReturnForm";

export default function CylinderReturnAddPage() {
  return (
    <>
      <div className="mb-4">
        <Link href="/operations/cylinder-return" className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to Manage Sale Return
        </Link>
      </div>
      <CylinderReturnForm />
    </>
  );
}
