"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import Link from "next/link";
import { validateFormValues, type FormFieldDefinition } from "@/lib/form-validation";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type LookupName = "customers" | "vendors" | "items" | "banks";
type Field = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox";
  required?: boolean;
  lookup?: LookupName;
  min?: number;
};

const lookupEndpoints: Record<LookupName, string> = {
  customers: "/api/customers",
  vendors: "/api/vendors",
  items: "/api/items",
  banks: "/api/banks",
};

function optionLabel(row: Record<string, unknown>) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

export function OperationForm({
  title,
  description,
  endpoint,
  submitLabel,
  fields,
  printableDocumentType,
  printableHrefBase,
}: {
  title: string;
  description: string;
  endpoint: string;
  submitLabel: string;
  fields: Field[];
  printableDocumentType?: string;
  printableHrefBase?: string;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [lookups, setLookups] = useState<Record<string, Record<string, unknown>[]>>({});
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");

  const neededLookups = useMemo(() => Array.from(new Set(fields.map((field) => field.lookup).filter(Boolean))) as LookupName[], [fields]);

  useEffect(() => {
    Promise.all(
      neededLookups.map(async (lookup) => {
        const data = await apiGet<Record<string, Record<string, unknown>[]>>(lookupEndpoints[lookup]);
        return [lookup, data[lookup] ?? []] as const;
      }),
    )
      .then((entries) => setLookups(Object.fromEntries(entries)))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, [neededLookups]);

  function payload() {
    const errors = validateFormValues(values, fields as FormFieldDefinition[]);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      throw new Error("Fix highlighted fields.");
    }
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      const value = values[field.name];
      if (field.required && (value === undefined || value === "")) {
        throw new Error(`${field.label} is required.`);
      }
      if (value === undefined || value === "") {
        continue;
      }
      body[field.name] = field.type === "number" ? Number(value) : value;
    }
    return body;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const result = await apiPost<Record<string, unknown>>(endpoint, payload());
      const number = result.issueNo ?? result.receiptNo ?? result.voucherNo ?? result.returnNo ?? result.batchNo ?? "saved";
      setSuccess(`Saved ${String(number)}.`);
      if (printableDocumentType && result.ids && number !== "saved") {
        setPrintDocumentNo(String(number));
      }
      setValues({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title={title} description={description} />
      <form onSubmit={onSubmit} className="max-w-3xl space-y-4">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {printableDocumentType && printDocumentNo ? (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            Document number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`${printableHrefBase ?? ""}/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-slate-950 underline">
              Open printable view
            </Link>
          </div>
        ) : null}
        <FormSection title={title}>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field.name} className={field.type === "checkbox" ? "flex items-center gap-2 text-sm text-slate-700 md:col-span-2" : "block text-sm text-slate-700"}>
                {field.type === "checkbox" ? null : <span className="mb-1 block font-medium">{field.label}</span>}
                {field.required && field.type !== "checkbox" ? <span className="text-red-600"> *</span> : null}
                {field.type === "select" ? (
                  <select
                    value={String(values[field.name] ?? "")}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    disabled={lookupLoading}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">Select {field.label}</option>
                    {(lookups[field.lookup ?? "customers"] ?? []).map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {optionLabel(row)}
                      </option>
                    ))}
                  </select>
                ) : field.type === "checkbox" ? (
                  <>
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.name])}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span>{field.label}</span>
                  </>
                ) : (
                  <input
                    type={field.type}
                    min={field.min}
                    value={String(values[field.name] ?? "")}
                    onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                )}
                {fieldErrors[field.name] ? <span className="mt-1 block text-xs text-red-700">{fieldErrors[field.name]}</span> : null}
              </label>
            ))}
          </div>
        </FormSection>
        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>{submitLabel}</SubmitButton>
          <button type="button" onClick={() => { setValues({}); setFieldErrors({}); setError(""); setSuccess(""); }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
