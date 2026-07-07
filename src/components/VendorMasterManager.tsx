"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { validateFormValues, type FormFieldDefinition } from "@/lib/form-validation";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Option = { value: string; label: string };
type Field = FormFieldDefinition & {
  options?: string[];
  optionSource?: { endpoint: string; dataKey: string; valueKey?: string; labelKey?: string };
};

const fields: Field[] = [
  { name: "code", label: "Code", type: "text", required: true },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "contactPerson", label: "Contact Person", type: "text" },
  { name: "phone", label: "Phone", type: "text" },
  { name: "cell", label: "Cell", type: "text" },
  { name: "email", label: "Email", type: "text" },
  { name: "address", label: "Address", type: "text" },
  { name: "cityId", label: "City", type: "select", optionSource: { endpoint: "/api/configuration/cities", dataKey: "cities" } },
  { name: "areaId", label: "Area", type: "select", optionSource: { endpoint: "/api/configuration/area", dataKey: "areas", labelKey: "cityName" } },
  { name: "segmentType", label: "Segment", type: "text" },
  { name: "registrationDate", label: "Registration Date", type: "date" },
  { name: "companyRegNo", label: "Company Reg No", type: "text" },
  { name: "vatNumber", label: "VAT No", type: "text" },
  { name: "creditDays", label: "Credit Days", type: "number", min: 0 },
  { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
];

function emptyValues() {
  return Object.fromEntries(fields.map((field) => [field.name, field.name === "status" ? "ACTIVE" : ""]));
}

export function VendorMasterManager() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [brandOptions, setBrandOptions] = useState<Option[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Option[]>>({});
  const [values, setValues] = useState<Record<string, string>>(emptyValues());
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const optionFields = fields.filter((field) => field.optionSource);
    const [data, brands, ...optionData] = await Promise.all([
      apiGet<Record<string, Record<string, unknown>[]>>("/api/vendors?all=1"),
      apiGet<Record<string, Record<string, unknown>[]>>("/api/configuration/brand-coding?all=1"),
      ...optionFields.map((field) => apiGet<Record<string, Record<string, unknown>[]>>(`${field.optionSource?.endpoint}?all=1`)),
    ]);
    setRows(data.vendors ?? []);
    setBrandOptions(
      (brands.brands ?? []).map((brand) => ({
        value: String(brand.id ?? ""),
        label: String(brand.name ?? ""),
      })),
    );
    setDynamicOptions(
      Object.fromEntries(
        optionFields.map((field, index) => {
          const source = field.optionSource as NonNullable<Field["optionSource"]>;
          const sourceRows = optionData[index][source.dataKey] ?? [];
          return [
            field.name,
            sourceRows.map((row) => ({
              value: String(row[source.valueKey ?? "id"] ?? ""),
              label: String(row[source.labelKey ?? "name"] ?? ""),
            })),
          ];
        }),
      ),
    );
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  function reset() {
    setValues(emptyValues());
    setSelectedBrandIds([]);
    setEditingId("");
    setFieldErrors({});
  }

  function edit(row: Record<string, unknown>) {
    setEditingId(String(row.id));
    setValues(Object.fromEntries(fields.map((field) => [field.name, String(row[field.name] ?? (field.name === "status" ? "ACTIVE" : ""))])));
    setSelectedBrandIds(Array.isArray(row.brandIds) ? row.brandIds.map(String) : []);
  }

  function toggleBrand(brandId: string) {
    setSelectedBrandIds((current) => (current.includes(brandId) ? current.filter((id) => id !== brandId) : [...current, brandId]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const errors = validateFormValues(values, fields);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = {
        ...Object.fromEntries(
          fields
            .filter((field) => values[field.name] !== "")
            .map((field) => [field.name, field.type === "number" ? Number(values[field.name]) : values[field.name]]),
        ),
        brandIds: selectedBrandIds,
      };
      if (editingId) {
        await apiPut(`/api/vendors/${editingId}`, payload);
      } else {
        await apiPost("/api/vendors", payload);
      }
      setSuccess(editingId ? "Record updated." : "Record created.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Vendors" description="Vendor master with contact, location, registration, credit terms, and brand mapping." />
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form onSubmit={onSubmit} className="space-y-4">
          <ApiError message={error} />
          <SuccessMessage message={success} />
          <FormSection title={editingId ? "Edit Vendors" : "Create Vendors"}>
            <div className="space-y-3">
              {fields.map((field) => (
                <label key={field.name} className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">
                    {field.label}
                    {field.required ? <span className="text-red-600"> *</span> : null}
                  </span>
                  {field.options || field.optionSource ? (
                    <select
                      value={values[field.name] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                    >
                      {field.optionSource ? <option value="">Select {field.label}</option> : null}
                      {(field.optionSource ? dynamicOptions[field.name] ?? [] : field.options?.map((option) => ({ value: option, label: option })) ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={values[field.name] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    />
                  )}
                  {fieldErrors[field.name] ? <span className="mt-1 block text-xs text-red-700">{fieldErrors[field.name]}</span> : null}
                </label>
              ))}
              <div className="block text-sm text-slate-700">
                <span className="mb-2 block font-medium">Brands</span>
                <div className="grid gap-2 rounded-md border border-slate-200 p-3">
                  {brandOptions.length === 0 ? <span className="text-xs text-slate-500">No brands configured.</span> : null}
                  {brandOptions.map((brand) => (
                    <label key={brand.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedBrandIds.includes(brand.value)} onChange={() => toggleBrand(brand.value)} />
                      {brand.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>
          <div className="flex gap-2">
            <button disabled={saving} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Reset
            </button>
          </div>
        </form>
        <DataTable
          rows={rows}
          loading={loading}
          columns={[
            { key: "code", label: "Code" },
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email" },
            { key: "cityName", label: "City" },
            { key: "brandNames", label: "Brands" },
            { key: "creditDays", label: "Credit Days" },
            { key: "status", label: "Status" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button onClick={() => edit(row)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                  Edit
                </button>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
