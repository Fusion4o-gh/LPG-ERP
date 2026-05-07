"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { validateFormValues, type FormFieldDefinition } from "@/lib/form-validation";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Field = FormFieldDefinition & { options?: string[] };
type Column = { key: string; label: string };

const highRiskEndpoints = new Set(["/api/banks", "/api/items", "/api/chart-of-accounts"]);

function emptyValues(fields: Field[]) {
  return Object.fromEntries(fields.map((field) => [field.name, field.name === "status" ? "ACTIVE" : ""]));
}

export function MasterDataManager({
  title,
  description,
  endpoint,
  dataKey,
  fields,
  columns,
}: {
  title: string;
  description: string;
  endpoint: string;
  dataKey: string;
  fields: Field[];
  columns: Column[];
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [values, setValues] = useState<Record<string, string>>(emptyValues(fields));
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const data = await apiGet<Record<string, Record<string, unknown>[]>>(`${endpoint}?all=1`);
    setRows(data[dataKey] ?? []);
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
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form onSubmit={onSubmit} className="space-y-4">
          <ApiError message={error} />
          <SuccessMessage message={success} />
          <FormSection title={editingId ? `Edit ${title}` : `Create ${title}`}>
            <div className="space-y-3">
              {fields.map((field) => (
                <label key={field.name} className="block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">
                    {field.label}
                    {field.required ? <span className="text-red-600"> *</span> : null}
                  </span>
                  {field.options ? (
                    <select value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type={field.type} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                  )}
                  {fieldErrors[field.name] ? <span className="mt-1 block text-xs text-red-700">{fieldErrors[field.name]}</span> : null}
                </label>
              ))}
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
            ...columns,
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
