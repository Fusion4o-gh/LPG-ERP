import { Suspense } from "react";
import { ReversalPanel } from "@/components/ReversalPanel";

export default function ReversalsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading reversal form…</p>}>
      <ReversalPanel />
    </Suspense>
  );
}
