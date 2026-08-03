"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Account = { id: string; code: string; name: string; accountType: string };
type Line = { id: number; accountId: string; description: string; debit: string; credit: string };
type Voucher = { id: string; voucherNo: string; voucherDate: string; narration: string | null; totalDebit: string; totalCredit: string };
let nextLineId = 1;
const blankLine = (): Line => ({ id: nextLineId++, accountId: "", description: "", debit: "", credit: "" });

export function OpeningVoucherPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [date, setDate] = useState("");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine(), blankLine()]);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [posted, setPosted] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    apiGet<{ accounts: Account[]; vouchers: Voucher[] }>("/api/accounting/opening-vouchers")
      .then((data) => { setAccounts(data.accounts); setVouchers(data.vouchers); })
      .catch((err: Error) => setLoadError(err.message));
  }
  useEffect(reload, []);

  const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const balanced = debit > 0 && Math.abs(debit - credit) < 0.005;
  function update(id: number, key: keyof Omit<Line, "id">, value: string) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, [key]: value } : line));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!balanced) return;
    setSubmitting(true); setError(""); setPosted("");
    try {
      const result = await apiPost<{ voucherNo: string }>("/api/accounting/opening-vouchers", {
        voucherDate: date,
        narration: narration || undefined,
        lines: lines.map((line) => ({ accountId: line.accountId, description: line.description || undefined, debit: Number(line.debit) || 0, credit: Number(line.credit) || 0 })),
      });
      setPosted(result.voucherNo); setDate(""); setNarration(""); setLines([blankLine(), blankLine()]); reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to post opening voucher."); }
    finally { setSubmitting(false); }
  }

  return <section>
    <PageHeader title="Opening Voucher" description="Post the opening accounting balances for the financial year." />
    <ApiError message={loadError} />
    <form onSubmit={submit} className="mb-6 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Narration<input value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="Opening balances" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead className="bg-blue-50"><tr><th className="border px-2 py-2 text-left">Account</th><th className="border px-2 py-2 text-left">Description</th><th className="border px-2 py-2 text-right">Debit</th><th className="border px-2 py-2 text-right">Credit</th><th className="border px-2 py-2" /></tr></thead><tbody>
        {lines.map((line) => <tr key={line.id}><td className="border px-2 py-1"><select required value={line.accountId} onChange={(event) => update(line.id, "accountId", event.target.value)} className="w-full rounded border px-2 py-1"><option value="">Select Account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></td><td className="border px-2 py-1"><input value={line.description} onChange={(event) => update(line.id, "description", event.target.value)} className="w-full rounded border px-2 py-1" /></td><td className="border px-2 py-1"><input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => update(line.id, "debit", event.target.value)} className="w-full rounded border px-2 py-1 text-right" /></td><td className="border px-2 py-1"><input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => update(line.id, "credit", event.target.value)} className="w-full rounded border px-2 py-1 text-right" /></td><td className="border px-2 py-1 text-center"><button type="button" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="text-xs text-red-600 disabled:opacity-40">Remove</button></td></tr>)}
      </tbody><tfoot><tr><td colSpan={2} className="border px-2 py-2"><button type="button" onClick={() => setLines((current) => [...current, blankLine()])} className="text-sm text-blue-700">+ Add Row</button></td><td className="border px-2 py-2 text-right">{debit.toFixed(2)}</td><td className="border px-2 py-2 text-right">{credit.toFixed(2)}</td><td className="border" /></tr></tfoot></table></div>
      <p className={`mt-2 text-sm ${balanced ? "text-green-600" : "text-red-600"}`}>{balanced ? "Balanced" : `Difference: ${Math.abs(debit - credit).toFixed(2)}`}</p>
      <button disabled={!balanced || submitting} className="mt-3 rounded-md bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40">{submitting ? "Posting..." : "Post Opening Voucher"}</button>
      <ApiError message={error} /><SuccessMessage message={posted ? `Opening voucher ${posted} posted successfully.` : ""} />
    </form>
    <DataTable loading={false} rows={vouchers as unknown as Record<string, unknown>[]} columns={[{ key: "voucherNo", label: "Voucher No" }, { key: "voucherDate", label: "Date" }, { key: "narration", label: "Narration" }, { key: "totalDebit", label: "Debit" }, { key: "totalCredit", label: "Credit" }]} />
  </section>;
}

