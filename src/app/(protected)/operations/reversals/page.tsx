import { Suspense } from "react";
import { ReversalPanel } from "@/components/ReversalPanel";
import { ReversalHistory } from "@/components/ReversalHistory";

export default function ReversalsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading reversal form…</p>}>
      <div className="space-y-5"><ReversalPanel /><ReversalHistory /></div>
    </Suspense>
  );
}
