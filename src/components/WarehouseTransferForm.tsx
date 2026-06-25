"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";
import { WarehouseSelector } from "./WarehouseSelector";
import { CylinderState } from "@prisma/client";

type Lookup = Record<string, unknown>;

type TransferLine = {
  itemId: string;
  cylinderState: CylinderState;
  quantity: string;
  remarks: string;
};

const emptyLine: TransferLine = {
  itemId: "",
  cylinderState: CylinderState.FILLED,
  quantity: "1",
  remarks: "",
};

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

export function WarehouseTransferForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [companyId, setCompanyId] = useState("");
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [transferDate, setTransferDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [lines, setLines] = useState<TransferLine[]>([{ ...emptyLine }]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
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

  function updateLine(index: number, patch: Partial<TransferLine>) {
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
    setSourceLocationId("");
    setDestinationLocationId("");
    setTransferDate(new Date().toISOString().split("T")[0]);
    setLines([{ ...emptyLine }]);
    setSuccess("");
    setError("");
  }

  function validate(): string | null {
    if (!sourceLocationId) return "Source warehouse is required.";
    if (!destinationLocationId) return "Destination warehouse is required.";
    if (sourceLocationId === destinationLocationId)
      return "Source and destination warehouses must be different.";
    if (!transferDate) return "Transfer date is required.";

    const validLines = lines.filter(
      (l) => l.itemId && Number(l.quantity) > 0,
    );
    if (validLines.length === 0)
      return "At least one line with a positive quantity is required.";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.itemId) return `Line ${i + 1}: item is required.`;
      const qty = Number(line.quantity);
      if (!Number.isInteger(qty) || qty <= 0)
        return `Line ${i + 1}: quantity must be a positive integer.`;
    }

    return null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sourceLocationId,
        destinationLocationId,
        transferDate,
        lines: lines
          .filter((l) => l.itemId && Number(l.quantity) > 0)
          .map((l) => ({
            itemId: l.itemId,
            cylinderState: l.cylinderState,
            quantity: Number(l.quantity),
            remarks: l.remarks || undefined,
          })),
      };

      const result = await apiPost<{ documentNo: string }>(
        "/api/inventory/warehouse-transfers",
        payload,
      );
      setSuccess(`Transfer created: ${result.documentNo}`);
      reset();
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create transfer.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          New Warehouse Transfer
        </h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-5 p-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="form-label" htmlFor="sourceLocationId">
              Source Warehouse *
            </label>
            <WarehouseSelector
              value={sourceLocationId}
              onChange={setSourceLocationId}
              companyId={companyId}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="destinationLocationId">
              Destination Warehouse *
            </label>
            <WarehouseSelector
              value={destinationLocationId}
              onChange={setDestinationLocationId}
              companyId={companyId}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="transferDate">
              Transfer Date *
            </label>
            <input
              id="transferDate"
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {sourceLocationId === destinationLocationId &&
          sourceLocationId !== "" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Source and destination warehouses must be different.
            </div>
          )}

        {/* Transfer Lines */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Transfer Lines
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
                    Quantity *
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
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(index, { quantity: e.target.value })
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
            Create Transfer
          </SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}
