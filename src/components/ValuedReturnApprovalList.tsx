"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Approval = { id: string; returnNo: string; transactionDate: string; customer: string; totalAmount: string; status: string };
export function ValuedReturnApprovalList() {
  const [rows, setRows] = useState<Approval[]>([]); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [busy, setBusy] = useState("");
  async function load() { const result = await apiGet<{ valuedReturnApprovals: Approval[] }>("/api/returns/cylinder"); setRows(result.valuedReturnApprovals); }
  useEffect(() => { load().catch((err: Error) => setError(err.message)); }, []);
  async function approve(id: string, returnNo: string) { setBusy(id); setError(""); setSuccess(""); try { await apiPost(`/api/returns/cylinder/approvals/${id}/approve`, {}); setSuccess(`Valued return ${returnNo} approved and posted.`); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Approval failed."); } finally { setBusy(""); } }
  async function reject(id: string, returnNo: string) { setBusy(id); setError(""); setSuccess(""); try { await apiPost(`/api/returns/cylinder/approvals/${id}/reject`, {}); setSuccess(`Valued return ${returnNo} rejected.`); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Rejection failed."); } finally { setBusy(""); } }
  return <section className="mt-8"><PageHeader title="Valued Return Approvals" description="Review pending filled-cylinder return credits before they affect stock and accounts." /><ApiError message={error} /><SuccessMessage message={success} /><div className="card overflow-x-auto rounded-xl"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr>{["Return #", "Customer", "Date", "Amount", "Status", "Action"].map((label) => <th key={label} className="border-b px-3 py-2">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b"><td className="px-3 py-2 font-medium">{row.returnNo}</td><td className="px-3 py-2">{row.customer}</td><td className="px-3 py-2">{row.transactionDate}</td><td className="px-3 py-2">{row.totalAmount}</td><td className="px-3 py-2">{row.status}</td><td className="flex gap-1 px-3 py-2">{row.status === "PENDING" ? <><button type="button" className="btn-primary !px-2 !py-1 !text-xs" disabled={!!busy} onClick={() => approve(row.id, row.returnNo)}>Approve &amp; Post</button><button type="button" className="btn-outline !px-2 !py-1 !text-xs" disabled={!!busy} onClick={() => reject(row.id, row.returnNo)}>Reject</button></> : <span className="text-slate-500">Completed</span>}</td></tr>)}{rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No valued returns awaiting approval.</td></tr> : null}</tbody></table></div></section>;
}
