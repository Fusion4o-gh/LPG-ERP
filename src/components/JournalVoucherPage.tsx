"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Account = { id: string; code: string; name: string };
type JvLine = { uid: number; accountId: string; description: string; debit: string; credit: string };
type VoucherRow = { id: string; voucherNo: string; voucherDate: string; narration: string | null; totalDebit: string; totalCredit: string };

let lineCounter = 1;

function emptyLine(): JvLine {
  return { uid: lineCounter++, accountId: "", description: "", debit: "", credit: "" };
}

function money(value: string | undefined) {
  return Number(value ?? 0).toFixed(2);
}

export function JournalVoucherPage() {
  const formId = useId();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [voucherDate, setVoucherDate] = useState("");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JvLine[]>([emptyLine(), emptyLine()]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [postedNo, setPostedNo] = useState("");

  function reloadVouchers() {
    apiGet<{ vouchers: VoucherRow[] }>("/api/accounting/journal-vouchers")
      .then((data) => setVouchers(data.vouchers))
      .catch((err: Error) => setLoadError(err.message));
  }

  useEffect(() => {
    Promise.all([
      apiGet<{ accounts: Account[] }>("/api/chart-of-accounts"),
      apiGet<{ vouchers: VoucherRow[] }>("/api/accounting/journal-vouchers"),
    ])
      .then(([acctData, jvData]) => {
        setAccounts(acctData.accounts);
        setVouchers(jvData.vouchers);
      })
      .catch((err: Error) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(uid: number) {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  function updateLine(uid: number, field: keyof Omit<JvLine, "uid">, value: string) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, [field]: value } : l)));
  }

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = diff < 0.005 && totalDebit > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isBalanced) return;
    setSubmitting(true);
    setFormError("");
    setPostedNo("");
    try {
      const result = await apiPost<{ voucherNo: string }>("/api/accounting/journal-vouchers", {
        voucherDate,
        narration: narration || undefined,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          description: l.description || undefined,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        })),
      });
      setPostedNo(result.voucherNo);
      setVoucherDate("");
      setNarration("");
      setLines([emptyLine(), emptyLine()]);
      reloadVouchers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to post journal voucher.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <PageHeader title="Journal Vouchers" description="Create and view manual journal vouchers." />

      <ApiError message={loadError} />

      <div className="mb-6 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-blue-700">Create Journal Voucher</h2>

        <form id={formId} onSubmit={handleSubmit}>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                required
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Narration</label>
              <input
                type="text"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Optional narration"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-blue-50 text-left">
                <tr>
                  <th className="border border-blue-100 px-3 py-2">Account</th>
                  <th className="border border-blue-100 px-3 py-2">Description</th>
                  <th className="border border-blue-100 px-3 py-2 text-right">Debit</th>
                  <th className="border border-blue-100 px-3 py-2 text-right">Credit</th>
                  <th className="border border-blue-100 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.uid}>
                    <td className="border border-slate-200 px-2 py-1">
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => updateLine(line.uid, "accountId", e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">Select Account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(line.uid, "description", e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={(e) => updateLine(line.uid, "debit", e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={(e) => updateLine(line.uid, "credit", e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.uid)}
                        disabled={lines.length <= 1}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-medium text-sm">
                <tr>
                  <td className="border border-slate-200 px-3 py-2" colSpan={2}>
                    <button
                      type="button"
                      onClick={addLine}
                      className="rounded px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
                    >
                      + Add Row
                    </button>
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{totalDebit.toFixed(2)}</td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{totalCredit.toFixed(2)}</td>
                  <td className="border border-slate-200 px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={`mt-2 text-sm font-medium ${isBalanced ? "text-green-600" : "text-red-600"}`}>
            {isBalanced ? "Balanced" : totalDebit === 0 && totalCredit === 0 ? "Enter amounts" : `Difference: ${diff.toFixed(2)}`}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={!isBalanced || submitting}
              className="rounded-md bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "Posting..." : "Post Journal Voucher"}
            </button>
            {postedNo ? (
              <Link href={`/payments/journal-vouchers/print/${encodeURIComponent(postedNo)}`} className="text-sm text-blue-700 underline">
                Print {postedNo}
              </Link>
            ) : null}
          </div>
        </form>

        <ApiError message={formError} />
        <SuccessMessage message={postedNo ? `Journal voucher ${postedNo} posted successfully.` : ""} />
      </div>

      <DataTable
        loading={loading}
        rows={vouchers as unknown as Record<string, unknown>[]}
        columns={[
          {
            key: "voucherNo",
            label: "Voucher No",
            render: (row) => (
              <Link className="font-semibold text-slate-950 underline" href={`/payments/journal-vouchers/print/${encodeURIComponent(String(row.voucherNo))}`}>
                {String(row.voucherNo)}
              </Link>
            ),
          },
          { key: "voucherDate", label: "Date", render: (row) => String(row.voucherDate).slice(0, 10) },
          { key: "narration", label: "Narration" },
          { key: "totalDebit", label: "Total Debit", render: (row) => money(row.totalDebit as string) },
          { key: "totalCredit", label: "Total Credit", render: (row) => money(row.totalCredit as string) },
        ]}
      />
    </section>
  );
}
