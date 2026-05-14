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
      <form onSubmit={onSubmit} className="max-w-3xl space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        {printableDocumentType && printDocumentNo ? (
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">Document number: <span className="font-semibold text-slate-900">{printDocumentNo}</span></span>
            <Link href={`${printableHrefBase ?? ""}/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        <FormSection title={title}>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className={field.type === "checkbox" ? "flex items-center gap-2 md:col-span-2" : "block"}>
                {field.type === "checkbox" ? (
                  <>
                    <input
                      type="checkbox"
                      id={field.name}
                      checked={Boolean(values[field.name])}
                      onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <label htmlFor={field.name} className="text-sm text-slate-700">{field.label}</label>
                  </>
                ) : (
                  <>
                    <label className="form-label" htmlFor={field.name}>
                      {field.label}{field.required ? " *" : ""}
                    </label>
                    {field.type === "select" ? (
                      <select
                        id={field.name}
                        value={String(values[field.name] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                        disabled={lookupLoading}
                        className="form-input"
                      >
                        <option value="">Select {field.label}</option>
                        {(lookups[field.lookup ?? "customers"] ?? []).map((row) => (
                          <option key={String(row.id)} value={String(row.id)}>
                            {optionLabel(row)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={field.name}
                        type={field.type}
                        min={field.min}
                        value={String(values[field.name] ?? "")}
                        onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                        className="form-input"
                      />
                    )}
                    {fieldErrors[field.name] ? <span className="mt-1 block text-xs text-red-600">{fieldErrors[field.name]}</span> : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </FormSection>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>{submitLabel}</SubmitButton>
          <button type="button" onClick={() => { setValues({}); setFieldErrors({}); setError(""); setSuccess(""); }} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
