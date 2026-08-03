"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";
import { todayDateInputValue } from "@/lib/use-company-form-settings";

type Option = { id: string; name: string; contractNo?: string };
type Loading = {
  id: string;
  loadingNo: string;
  contractNo: string;
  importType: string;
  productName: string;
  quantityLoaded: string;
  arrivedQuantity: string | null;
  loadingDate: string;
  shipmentStatus: string;
  locationName: string;
};

const initialValues = {
  contractId: "",
  loadingDate: todayDateInputValue(),
  stockLocationId: "",
  quantityLoaded: "",
  unit: "MT",
  rate: "0",
  freight: "0",
  loadingLocation: "",
  vehicleId: "",
  transporterId: "",
  remarks: "",
};

const formFields = [
  ["contractId", "Import contract"],
  ["loadingDate", "Loading date"],
  ["stockLocationId", "Transit location"],
  ["quantityLoaded", "Quantity loaded"],
  ["rate", "Rate"],
  ["freight", "Freight"],
  ["loadingLocation", "Loading location"],
  ["vehicleId", "Vehicle"],
  ["transporterId", "Transporter"],
  ["remarks", "Remarks"],
] as const;

export function LoadingManager() {
  const [rows, setRows] = useState<Loading[]>([]);
  const [contracts, setContracts] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [vehicles, setVehicles] = useState<Option[]>([]);
  const [transporters, setTransporters] = useState<Option[]>([]);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [receive, setReceive] = useState<Record<string, { date: string; locationId: string; quantity: string }>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [loadingData, contractData, locationData, vehicleData, transporterData] = await Promise.all([
      apiGet<{ loadings: Loading[] }>("/api/import/loadings"),
      apiGet<{ importContracts: Option[] }>("/api/import/import-contracts"),
      apiGet<{ stockLocations: Option[] }>("/api/configuration/stock-locations?all=1"),
      apiGet<{ vehicles: Option[] }>("/api/configuration/vehicles?all=1"),
      apiGet<{ transporters: Option[] }>("/api/configuration/transporters?all=1"),
    ]);
    setRows(loadingData.loadings);
    setContracts(contractData.importContracts);
    setLocations(locationData.stockLocations);
    setVehicles(vehicleData.vehicles);
    setTransporters(transporterData.transporters);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  function set(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await apiPost("/api/import/loadings", Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "")));
      setSuccess("Loading created and placed in transit.");
      setValues((current) => ({ ...current, contractId: "", quantityLoaded: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function receiveLoading(row: Loading) {
    const current = receive[row.id];
    if (!current?.locationId || !current.quantity) {
      setError("Select an arrival location and quantity first.");
      return;
    }
    setError("");
    setSuccess("");
    try {
      await apiPost(`/api/import/loadings/${row.id}/receive`, {
        arrivalDate: current.date,
        arrivalLocationId: current.locationId,
        arrivedQuantity: Number(current.quantity),
      });
      setSuccess(`${row.loadingNo} received into stock.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receiving failed.");
    }
  }

  function inputType(name: string) {
    if (name === "loadingDate") return "date";
    if (["quantityLoaded", "rate", "freight"].includes(name)) return "number";
    return "text";
  }

  function optionsFor(name: string) {
    if (name === "contractId") return contracts;
    if (name === "stockLocationId") return locations;
    if (name === "vehicleId") return vehicles;
    return transporters;
  }

  return (
    <>
      <PageHeader title="Import Loading & Shipments" description="Record Taftan/ship loading, track in-transit quantities, and receive bulk stock at the destination location." />
      <ApiError message={error} />
      <SuccessMessage message={success} />
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,390px)_1fr]">
        <form onSubmit={create} className="space-y-3">
          <FormSection title="New loading">
            <div className="space-y-2.5">
              {formFields.map(([name, label]) => (
                <label key={name} className="block">
                  <span className="form-label">{label}</span>
                  {name === "contractId" || name === "stockLocationId" || name === "vehicleId" || name === "transporterId" ? (
                    <select className="form-select" value={values[name]} onChange={(event) => set(name, event.target.value)} required={name === "contractId" || name === "stockLocationId"}>
                      <option value="">Select {label.toLowerCase()}</option>
                      {optionsFor(name).map((option) => <option key={option.id} value={option.id}>{option.contractNo ?? option.name}</option>)}
                    </select>
                  ) : (
                    <input className="form-input" type={inputType(name)} value={values[name]} onChange={(event) => set(name, event.target.value)} required={name === "loadingDate" || name === "quantityLoaded"} />
                  )}
                </label>
              ))}
            </div>
          </FormSection>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Create loading"}</button>
        </form>

        <div>
          <DataTable
            rows={rows}
            loading={loading}
            columns={[
              { key: "loadingNo", label: "Loading" },
              { key: "contractNo", label: "Contract" },
              { key: "importType", label: "Type" },
              { key: "productName", label: "Product" },
              { key: "quantityLoaded", label: "Loaded" },
              { key: "arrivedQuantity", label: "Received" },
              { key: "shipmentStatus", label: "Status" },
              { key: "actions", label: "Actions", render: (row) => <Link href={`/documents/print/loading/${encodeURIComponent(String(row.loadingNo))}`} className="btn-outline !px-2 !py-1 !text-xs">Print</Link> },
            ]}
          />
          <div className="mt-4 space-y-3">
            {rows.filter((row) => row.shipmentStatus === "IN_TRANSIT").map((row) => (
              <div key={row.id} className="rounded border border-[var(--border)] p-3">
                <div className="mb-2 text-sm font-semibold">Receive {row.loadingNo} ({row.quantityLoaded} MT)</div>
                <div className="grid gap-2 md:grid-cols-4">
                  <input className="form-input" type="date" value={receive[row.id]?.date ?? todayDateInputValue()} onChange={(event) => setReceive((current) => ({ ...current, [row.id]: { date: event.target.value, locationId: current[row.id]?.locationId ?? "", quantity: current[row.id]?.quantity ?? row.quantityLoaded } }))} />
                  <select className="form-select" value={receive[row.id]?.locationId ?? ""} onChange={(event) => setReceive((current) => ({ ...current, [row.id]: { date: current[row.id]?.date ?? todayDateInputValue(), locationId: event.target.value, quantity: current[row.id]?.quantity ?? row.quantityLoaded } }))}>
                    <option value="">Arrival location</option>
                    {locations.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                  <input className="form-input" type="number" value={receive[row.id]?.quantity ?? row.quantityLoaded} onChange={(event) => setReceive((current) => ({ ...current, [row.id]: { date: current[row.id]?.date ?? todayDateInputValue(), locationId: current[row.id]?.locationId ?? "", quantity: event.target.value } }))} />
                  <button className="btn-primary" onClick={() => receiveLoading(row)}>Receive</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
