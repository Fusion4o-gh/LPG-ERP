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
type Column = { key: string; label: string };
type ActionLink = { label: string; hrefTemplate: string };

function printDescriptor(endpoint: string, row: Record<string, unknown>) {
  const documentNo = row.documentNo ?? row.loadingNo;
  if (!documentNo) return null;
  const type = endpoint === "/api/import/local-purchase" ? "local-purchase"
    : endpoint === "/api/import/delivered-sale" ? "delivered-sale"
      : endpoint === "/api/plant/sales" ? (row.saleType === "FILLING" ? "filling-sale" : "plant-bulk-sale")
        : endpoint === "/api/plant/plant-transfer" ? "plant-transfer"
          : endpoint === "/api/plant/plant-decanting" ? "plant-decanting"
              : endpoint === "/api/plant/partial-receiving" ? "partial-receiving"
              : endpoint === "/api/plant/partial-sales" ? "partial-plant-sale"
              : endpoint === "/api/dollar/transactions" ? "dollar-transaction"
                : endpoint === "/api/dollar/settlements" ? "dollar-settlement" : "";
  return type ? { type, documentNo: String(documentNo) } : null;
}

const highRiskEndpoints = new Set(["/api/banks", "/api/items", "/api/chart-of-accounts"]);

function emptyValues(fields: Field[]) {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.name === "status" ? "ACTIVE" : field.required && field.options?.[0] ? field.options[0] : "",
    ]),
  );
}

export function MasterDataManager({
  title,
  description,
  endpoint,
  dataKey,
  fields,
  columns,
  actionLinks = [],
}: {
  title: string;
  description: string;
  endpoint: string;
  dataKey: string;
  fields: Field[];
  columns: Column[];
  actionLinks?: ActionLink[];
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Option[]>>({});
  const [values, setValues] = useState<Record<string, string>>(emptyValues(fields));
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const optionFields = fields.filter((field) => field.optionSource);
    const [data, ...optionData] = await Promise.all([
      apiGet<Record<string, Record<string, unknown>[]>>(`${endpoint}?all=1`),
      ...optionFields.map((field) => apiGet<Record<string, Record<string, unknown>[]>>(`${field.optionSource?.endpoint}?all=1`)),
    ]);
    setRows(data[dataKey] ?? []);
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
  }, [endpoint, dataKey]);

  function reset() {
    setValues(emptyValues(fields));
    setEditingId("");
    setFieldErrors({});
  }

  function edit(row: Record<string, unknown>) {
    setEditingId(String(row.id));
    setValues(Object.fromEntries(fields.map((field) => [field.name, String(row[field.name] ?? (field.name === "status" ? "ACTIVE" : ""))])));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const errors = validateFormValues(values, fields);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (editingId && highRiskEndpoints.has(endpoint) && !window.confirm(`Confirm edit to ${title}. This affects operational controls.`)) return;

    setSaving(true);
    try {
      const payload = Object.fromEntries(
        fields
          .filter((field) => values[field.name] !== "")
          .map((field) => [field.name, field.type === "number" ? Number(values[field.name]) : values[field.name]]),
      );
      if (editingId) {
        await apiPut(`${endpoint}/${editingId}`, payload);
      } else {
        await apiPost(endpoint, payload);
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
      <PageHeader title={title} description={description} />
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_1fr]">
        <form onSubmit={onSubmit} className="space-y-3">
          <ApiError message={error} />
          <SuccessMessage message={success} />
          <FormSection title={editingId ? `Edit ${title}` : `Create ${title}`}>
            <div className="space-y-2.5">
              {fields.map((field) => (
                <label key={field.name} className="block">
                  <span className="form-label">
                    {field.label}
                    {field.required ? <span className="text-[var(--danger-red)]"> *</span> : null}
                  </span>
                  {field.options || field.optionSource ? (
                    <select
                      value={values[field.name] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      className="form-select"
                    >
                      {field.optionSource ? <option value="">Select {field.label}</option> : null}
                      {(field.optionSource ? dynamicOptions[field.name] ?? [] : field.options?.map((option) => ({ value: option, label: option })) ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "file" ? (
                    <>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (file.size > 1_000_000) {
                            setFieldErrors((current) => ({ ...current, [field.name]: "Image must be smaller than 1 MB." }));
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFieldErrors((current) => ({ ...current, [field.name]: "" }));
                            setValues((current) => ({ ...current, [field.name]: String(reader.result ?? "") }));
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="form-input"
                      />
                      {values[field.name]?.startsWith("data:image/") ? <img src={values[field.name]} alt={`${field.label} preview`} className="mt-2 h-16 w-16 rounded border border-slate-200 object-cover" /> : null}
                    </>
                  ) : (
                    <input
                      type={field.type}
                      value={values[field.name] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                      className="form-input"
                    />
                  )}
                  {fieldErrors[field.name] ? <span className="mt-1 block text-xs text-[var(--danger-red)]">{fieldErrors[field.name]}</span> : null}
                </label>
              ))}
            </div>
          </FormSection>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={reset} className="btn-outline">
              Reset
            </button>
          </div>
        </form>
        <DataTable
          rows={rows}
          loading={loading}
          enableControls
          columns={[
            ...columns,
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-1">
                  <button type="button" onClick={() => edit(row)} className="btn-outline !px-2 !py-1 !text-xs">Edit</button>
                  {actionLinks.map((action) => (
                    <a
                      key={action.label}
                      href={action.hrefTemplate.replaceAll("[id]", encodeURIComponent(String(row.id ?? "")))}
                      className="btn-outline !px-2 !py-1 !text-xs"
                    >
                      {action.label}
                    </a>
                  ))}
                  {(() => { const print = printDescriptor(endpoint, row); return print ? <a href={`/documents/print/${print.type}/${encodeURIComponent(print.documentNo)}`} className="btn-outline !px-2 !py-1 !text-xs">Print</a> : null; })()}
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
