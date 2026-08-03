"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";

type Reversal = { id: string; kind: string; originalDocumentNo: string; reversalNo: string; voucherNo: string; reason: string; createdAt: string; createdBy: string };

export function ReversalHistory() {
  const [rows, setRows] = useState<Reversal[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<{ reversals: Reversal[] }>("/api/reversals")
      .then((data) => setRows(data.reversals))
      .catch((err: Error) => setError(err.message));
  }, []);
  return <FormSection title="Reversal History">
    <ApiError message={error} />
    <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="px-3 py-2">Reversal No</th><th className="px-3 py-2">Original Document</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2">Created</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No reversals found.</td></tr> : rows.map((row) => <tr key={row.id} className="border-b"><td className="px-3 py-2 font-semibold">{row.reversalNo || "—"}</td><td className="px-3 py-2">{row.originalDocumentNo}</td><td className="px-3 py-2">{row.kind}</td><td className="px-3 py-2">{row.reason || "—"}</td><td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>
  </FormSection>;
}
