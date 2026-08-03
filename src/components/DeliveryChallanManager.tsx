"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import { todayDateInputValue, useCompanyFormSettings, usePostSaveNavigation } from "@/lib/use-company-form-settings";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";
import { WarehouseSelector } from "./WarehouseSelector";

type Lookup = Record<string, unknown>;
type ChallanLine = { itemId: string; quantity: string; remarks: string };

const emptyLine: ChallanLine = { itemId: "", quantity: "1", remarks: "" };

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

const today = todayDateInputValue;

export function DeliveryChallanForm({ onSuccess }: { onSuccess?: () => void }) {
  const { showDefaultDate, redirectOnSamePage, defaultTransactionDate, loaded: companySettingsLoaded } = useCompanyFormSettings();
  const { afterSave } = usePostSaveNavigation(redirectOnSamePage, "/operations/delivery-challan");

  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [transporters, setTransporters] = useState<Lookup[]>([]);
  const [vehicles, setVehicles] = useState<Lookup[]>([]);
  const [drivers, setDrivers] = useState<Lookup[]>([]);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [previewNo, setPreviewNo] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [challanDate, setChallanDate] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<ChallanLine[]>([{ ...emptyLine }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<{ customers: Lookup[] }>("/api/customers"),
      apiGet<{ items: Lookup[] }>("/api/items"),
      apiGet<{ transporters?: Lookup[]; rows?: Lookup[] }>("/api/configuration/transporters?all=1").catch(() => ({ transporters: [] })),
      apiGet<{ vehicles?: Lookup[] }>("/api/configuration/vehicles?all=1").catch(() => ({ vehicles: [] })),
      apiGet<{ drivers?: Lookup[] }>("/api/configuration/drivers?all=1").catch(() => ({ drivers: [] })),
      apiGet<{ documentNo: string }>("/api/sales/delivery-challan?preview=1").catch(() => ({ documentNo: "" })),
    ])
      .then(([customerData, itemData, transporterData, vehicleData, driverData, preview]) => {
        setCustomers(customerData.customers ?? []);
        setItems(itemData.items ?? []);
        setTransporters(("transporters" in transporterData ? transporterData.transporters : undefined) ?? ("rows" in transporterData ? transporterData.rows : undefined) ?? []);
        setVehicles(vehicleData.vehicles ?? []);
        setDrivers(driverData.drivers ?? []);
        setPreviewNo(preview.documentNo ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, []);

  useEffect(() => {
    if (companySettingsLoaded && showDefaultDate && !challanDate) {
      setChallanDate(defaultTransactionDate || today());
    }
  }, [companySettingsLoaded, showDefaultDate, defaultTransactionDate, challanDate]);

  function updateLine(index: number, patch: Partial<ChallanLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function reset() {
    setCustomerId("");
    setLocationId("");
    setChallanDate(showDefaultDate ? defaultTransactionDate || today() : "");
    setTransporterId("");
    setVehicleId("");
    setDriverId("");
    setRemarks("");
    setLines([{ ...emptyLine }]);
    setSuccess("");
    setError("");
    setPrintDocumentNo("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (!customerId) throw new Error("Customer is required.");
      if (!challanDate) throw new Error("Date is required.");
      const prepared = lines
        .filter((line) => line.itemId)
        .map((line, index) => {
          const quantity = Number(line.quantity);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: quantity must be a positive integer.`);
          return { itemId: line.itemId, quantity, remarks: line.remarks || undefined };
        });
      if (prepared.length === 0) throw new Error("Add at least one line.");

      const result = await apiPost<{ documentNo: string }>("/api/sales/delivery-challan", {
        customerId,
        locationId: locationId || undefined,
        challanDate,
        transporterId: transporterId || undefined,
        vehicleId: vehicleId || undefined,
        driverId: driverId || undefined,
        remarks: remarks || undefined,
        lines: prepared,
      });
      setPrintDocumentNo(result.documentNo);
      setSuccess(`Delivery challan ${result.documentNo} posted.`);
      afterSave(() => {
        reset();
        onSuccess?.();
      });
      apiGet<{ documentNo: string }>("/api/sales/delivery-challan?preview=1")
        .then((preview) => setPreviewNo(preview.documentNo))
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Delivery Challan"
        description="Dispatch filled cylinders without invoicing. Stock OUT and cylinder custody update; invoice later from Sale LPG."
        actions={previewNo ? <span className="badge-blue">Next DC #: {previewNo}</span> : null}
      />
      <form onSubmit={onSubmit} className="space-y-3">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {printDocumentNo ? (
          <div className="card flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
            <span className="text-steel-600">
              Challan: <span className="font-semibold text-gas-800">{printDocumentNo}</span>
            </span>
            <Link href={`/operations/delivery-challan/print/${encodeURIComponent(printDocumentNo)}`} className="btn-outline ml-auto !px-2.5 !py-1 !text-xs">
              Open Print View
            </Link>
          </div>
        ) : null}

        <section className="card overflow-hidden">
          <div className="accent-section-header">
            <div className="accent-bar" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-steel-600">Challan Header</h2>
          </div>
          <div className="grid gap-3 p-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="md:col-span-2">
              <label className="form-label" htmlFor="dc-customer">Customer *</label>
              <select id="dc-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={lookupLoading} className="form-select">
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>{optionLabel(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="dc-date">Date *</label>
              <input id="dc-date" type="date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Dispatch Warehouse</label>
              <WarehouseSelector value={locationId} onChange={setLocationId} disabled={lookupLoading} />
            </div>
            <div>
              <label className="form-label" htmlFor="dc-transporter">Transporter</label>
              <select id="dc-transporter" value={transporterId} onChange={(e) => setTransporterId(e.target.value)} className="form-select">
                <option value="">Optional</option>
                {transporters.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.code ?? row.id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="dc-vehicle">Vehicle</label>
              <select id="dc-vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="form-select">
                <option value="">Optional</option>
                {vehicles.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>{String(row.registrationNo ?? row.name ?? row.id)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="dc-driver">Driver</label>
              <select id="dc-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)} className="form-select">
                <option value="">Optional</option>
                {drivers.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>{String(row.name ?? row.id)}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className="form-label" htmlFor="dc-remarks">Remarks</label>
              <input id="dc-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
            </div>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="accent-section-header justify-between">
            <div className="flex items-center gap-2">
              <div className="accent-bar" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-steel-600">Lines</h2>
            </div>
            <button type="button" onClick={() => setLines((current) => [...current, { ...emptyLine }])} className="btn-primary-sm">
              + Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-collapse text-sm">
              <thead>
                <tr className="report-table-head">
                  <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase text-steel-500">Item</th>
                  <th className="px-2.5 py-2 text-right text-xs font-semibold uppercase text-steel-500">Qty</th>
                  <th className="px-2.5 py-2 text-left text-xs font-semibold uppercase text-steel-500">Remarks</th>
                  <th className="px-2.5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="px-2.5 py-2">
                      <select value={line.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value })} className="tbl-select w-full min-w-[220px]" disabled={lookupLoading}>
                        <option value="">Select Item</option>
                        {items.map((item) => (
                          <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="tbl-input w-24 text-right" />
                    </td>
                    <td className="px-2.5 py-2">
                      <input value={line.remarks} onChange={(e) => updateLine(index, { remarks: e.target.value })} className="tbl-input w-full" />
                    </td>
                    <td className="px-2.5 py-2">
                      <button type="button" disabled={lines.length <= 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="text-xs font-medium text-[var(--danger-red)] disabled:opacity-40">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="sticky bottom-0 z-[5] flex flex-wrap items-center gap-2 border-t border-[var(--surface-border)] bg-white/95 px-3 py-2.5">
          <SubmitButton loading={loading}>Post Challan</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset</button>
        </div>
      </form>
    </>
  );
}

export function DeliveryChallanList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from, to, limit: "100" });
      const data = await apiGet<{ challans: Record<string, unknown>[] }>(`/api/sales/delivery-challan?${params}`);
      setRows(data.challans ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function cancel(id: string) {
    if (!window.confirm("Cancel this delivery challan and return stock?")) return;
    try {
      await apiDelete(`/api/sales/delivery-challan/${id}?remarks=${encodeURIComponent("Cancelled from list")}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed.");
    }
  }

  return (
    <section className="card overflow-hidden mt-4">
      <div className="accent-section-header justify-between">
        <div className="flex items-center gap-2">
          <div className="accent-bar" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-steel-600">Recent Challans</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="block">
            <span className="form-label">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input !mt-0" />
          </label>
          <label className="block">
            <span className="form-label">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input !mt-0" />
          </label>
          <button type="submit" className="btn-primary-sm">Search</button>
        </form>
      </div>
      <ApiError message={error} />
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="report-table-head">
              {["Document", "Date", "Customer", "Qty", "Status", "Sale #", ""].map((h) => (
                <th key={h || "a"} className="px-3 py-2 text-left text-xs font-semibold uppercase text-steel-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)]">
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-steel-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-steel-500">No challans in range.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row.id)}>
                  <td className="px-3 py-2 font-medium">{String(row.documentNo)}</td>
                  <td className="px-3 py-2">{String(row.challanDate).slice(0, 10)}</td>
                  <td className="px-3 py-2">{String(row.customerName ?? "")}</td>
                  <td className="px-3 py-2 tabular-nums">{String(row.totalQuantity ?? 0)}</td>
                  <td className="px-3 py-2">{String(row.status)}</td>
                  <td className="px-3 py-2">{String(row.saleIssueNo ?? "—")}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link href={`/operations/delivery-challan/print/${encodeURIComponent(String(row.documentNo))}`} className="btn-outline !px-2 !py-1 !text-xs mr-1">
                      Print
                    </Link>
                    {row.status === "DISPATCHED" ? (
                      <button type="button" onClick={() => cancel(String(row.id))} className="text-xs font-medium text-[var(--danger-red)]">
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
