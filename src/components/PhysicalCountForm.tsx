"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";
import { WarehouseSelector } from "./WarehouseSelector";
import { CylinderState } from "@prisma/client";

type Lookup = Record<string, unknown>;

type CountLine = {
  itemId: string;
  cylinderState: CylinderState;
  countedQuantity: string;
  remarks: string;
};

const emptyLine: CountLine = {
  itemId: "",
  cylinderState: CylinderState.FILLED,
  countedQuantity: "0",
  remarks: "",
};

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

export function PhysicalCountForm({ onSuccess }: { onSuccess?: () => void }) {
  const [companyId, setCompanyId] = useState("");
  const [mode, setMode] = useState<"create" | "lines" | "approved">("create");
  const [countId, setCountId] = useState("");
  const [documentNo, setDocumentNo] = useState("");

  // Create mode state
  const [locationId, setLocationId] = useState("");
  const [countDate, setCountDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");

  // Lines mode state
  const [lines, setLines] = useState<CountLine[]>([{ ...emptyLine }]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  // General state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    apiGet<{ companyId: string }>("/api/context")
      .then((data) => setCompanyId(data.companyId))
      .catch(() => undefined);
    apiGet<{ items: Lookup[] }>("/api/items")
      .then((data) => setItems(data.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setItemsLoading(false));
  }, []);

  function updateLine(index: number, patch: Partial<CountLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function removeLine(index: number) {
    setLines((current) =>
      current.length === 1 ? current : current.filter((_, i) => i !== index),
    );
  }

  function reset() {
    setMode("create");
    setCountId("");
    setDocumentNo("");
    setLocationId("");
    setCountDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setLines([{ ...emptyLine }]);
    setSuccess("");
    setError("");
  }

  function validateCreate(): string | null {
    if (!locationId) return "Warehouse location is required.";
    if (!countDate) return "Count date is required.";
    return null;
  }

  function validateLines(): string | null {
    const validLines = lines.filter(
      (l) => l.itemId && Number(l.countedQuantity) >= 0,
    );
    if (validLines.length === 0)
      return "At least one line with a non-negative quantity is required.";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.itemId) return `Line ${i + 1}: item is required.`;
      const qty = Number(line.countedQuantity);
      if (!Number.isInteger(qty) || qty < 0)
        return `Line ${i + 1}: counted quantity must be a non-negative integer.`;
    }
    return null;
  }

  async function onCreateSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateCreate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiPost<{ documentNo: string; count: { id: string } }>(
        "/api/inventory/physical-counts",
        {
          locationId,
          countDate,
          notes: notes || undefined,
        },
      );
      setDocumentNo(result.documentNo);
      setCountId(result.count.id);
      setSuccess(`Count created: ${result.documentNo}. Now add counted lines.`);
      setMode("lines");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create count.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onLinesSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateLines();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await apiPost(`/api/inventory/physical-counts/${countId}/lines`, {
        lines: lines
          .filter((l) => l.itemId && Number(l.countedQuantity) >= 0)
          .map((l) => ({
            itemId: l.itemId,
            cylinderState: l.cylinderState,
            countedQuantity: Number(l.countedQuantity),
            remarks: l.remarks || undefined,
          })),
      });
      setSuccess("Lines added. Ready for approval.");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add lines.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onApprove() {
    setError("");
    setSuccess("");

    if (!confirm("Approve this count will post adjustment entries for all variances. Continue?")) {
      return;
    }

    setSubmitting(true);
    try {
      await apiPost(`/api/inventory/physical-counts/${countId}/approve`, {});
      setSuccess("Count approved. Adjustment entries posted.");
      setMode("approved");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve count.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {mode === "create"
            ? "New Physical Count"
            : mode === "lines"
              ? `Add Lines — ${documentNo}`
              : "Count Approved"}
        </h2>
      </div>

      {mode === "create" && (
        <form onSubmit={onCreateSubmit} className="space-y-5 p-5">
          <ApiError message={error} />
          <SuccessMessage message={success} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="form-label" htmlFor="locationId">
                Warehouse Location *
              </label>
              <WarehouseSelector
                value={locationId}
                onChange={setLocationId}
                companyId={companyId}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="countDate">
                Count Date *
              </label>
              <input
                id="countDate"
                type="date"
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="notes">
                Notes
              </label>
              <input
                id="notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-input"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <SubmitButton loading={submitting}>
              Create Count
            </SubmitButton>
            <button type="button" onClick={reset} className="btn-outline">
              Reset
            </button>
          </div>
        </form>
      )}

      {mode === "lines" && (
        <form onSubmit={onLinesSubmit} className="space-y-5 p-5">
          <ApiError message={error} />
          <SuccessMessage message={success} />

          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Count {documentNo} created. Add counted lines below.
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Count Lines
              </span>
              <button
                type="button"
                onClick={() => setLines((c) => [...c, { ...emptyLine }])}
                className="btn-primary-sm"
              >
                + Add Line
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Item *
                    </th>
                    <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      State
                    </th>
                    <th className="px-2.5 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Counted Qty *
                    </th>
                    <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Remarks
                    </th>
                    <th className="px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, index) => (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-2.5 py-2">
                        <select
                          value={line.itemId}
                          onChange={(e) =>
                            updateLine(index, { itemId: e.target.value })
                          }
                          disabled={itemsLoading}
                          className="tbl-select w-52"
                        >
                          <option value="">Select Item</option>
                          {items.map((item) => (
                            <option key={String(item.id)} value={String(item.id)}>
                              {optionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2">
                        <select
                          value={line.cylinderState}
                          onChange={(e) =>
                            updateLine(index, {
                              cylinderState: e.target.value as CylinderState,
                            })
                          }
                          className="tbl-select w-28"
                        >
                          <option value={CylinderState.FILLED}>Filled</option>
                          <option value={CylinderState.EMPTY}>Empty</option>
                        </select>
                      </td>
                      <td className="px-2.5 py-2">
                        <input
                          type="number"
                          min="0"
                          value={line.countedQuantity}
                          onChange={(e) =>
                            updateLine(index, { countedQuantity: e.target.value })
                          }
                          className="tbl-input w-24 text-right"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <input
                          type="text"
                          value={line.remarks}
                          onChange={(e) =>
                            updateLine(index, { remarks: e.target.value })
                          }
                          className="tbl-input w-40"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-2.5 py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={lines.length === 1}
                          className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <SubmitButton loading={submitting}>
              Save Lines
            </SubmitButton>
            <button type="button" onClick={onApprove} className="btn-primary" disabled={submitting}>
              Approve Count
            </button>
          </div>
        </form>
      )}

      {mode === "approved" && (
        <div className="space-y-4 p-5">
          <ApiError message={error} />
          <SuccessMessage message={success} />
          <p className="text-sm text-slate-600">
            Count {documentNo} has been approved and adjustment entries posted to the stock ledger.
          </p>
          <button type="button" onClick={reset} className="btn-outline">
            Create Another Count
          </button>
        </div>
      )}
    </section>
  );
}
