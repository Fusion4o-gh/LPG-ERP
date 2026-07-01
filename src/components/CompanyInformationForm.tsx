"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { apiGet, apiPut } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type WorkingDays = Record<string, boolean>;

type CompanyInfo = {
  legalName: string;
  tradeName?: string | null;
  ownerName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  taxRegistrationNumber?: string | null;
  nationalTaxNumber?: string | null;
  logoUrl?: string | null;
  stockAvailableCheck?: boolean;
  centralizedPricing?: boolean;
  showDefaultDate?: boolean;
  redirectOnSamePage?: boolean;
  workStartTime?: string | null;
  workEndTime?: string | null;
  workingDays?: WorkingDays | null;
};

type FormValues = {
  legalName: string;
  tradeName: string;
  ownerName: string;
  address: string;
  phone: string;
  email: string;
  taxRegistrationNumber: string;
  nationalTaxNumber: string;
  stockAvailableCheck: boolean;
  centralizedPricing: boolean;
  showDefaultDate: boolean;
  redirectOnSamePage: boolean;
  workStartTime: string;
  workEndTime: string;
  workingDays: WorkingDays;
};

const days = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
] as const;

const defaultWorkingDays = Object.fromEntries(days.map(([day]) => [day, day !== "sunday"])) as WorkingDays;

function emptyValues(): FormValues {
  return {
    legalName: "",
    tradeName: "",
    ownerName: "",
    address: "",
    phone: "",
    email: "",
    taxRegistrationNumber: "",
    nationalTaxNumber: "",
    stockAvailableCheck: true,
    centralizedPricing: false,
    showDefaultDate: true,
    redirectOnSamePage: false,
    workStartTime: "",
    workEndTime: "",
    workingDays: defaultWorkingDays,
  };
}

function valuesFromCompany(company: CompanyInfo): FormValues {
  return {
    legalName: company.legalName ?? "",
    tradeName: company.tradeName ?? "",
    ownerName: company.ownerName ?? "",
    address: company.address ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    taxRegistrationNumber: company.taxRegistrationNumber ?? "",
    nationalTaxNumber: company.nationalTaxNumber ?? "",
    stockAvailableCheck: company.stockAvailableCheck !== false,
    centralizedPricing: company.centralizedPricing === true,
    showDefaultDate: company.showDefaultDate !== false,
    redirectOnSamePage: company.redirectOnSamePage === true,
    workStartTime: company.workStartTime ?? "",
    workEndTime: company.workEndTime ?? "",
    workingDays: { ...defaultWorkingDays, ...(company.workingDays ?? {}) },
  };
}

function validate(values: FormValues) {
  const errors: Record<string, string> = {};
  if (!values.legalName.trim()) errors.legalName = "Business / Company Name is required.";
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Email must be valid.";
  return errors;
}

export function CompanyInformationForm() {
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGet<{ company: CompanyInfo }>("/api/configuration/company-information")
      .then((data) => {
        setValues(valuesFromCompany(data.company));
        setLogoUrl(data.company.logoUrl ?? null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogoUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/configuration/company-logo", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body?.error?.message ?? "Upload failed.");
      setLogoUrl(body.logoUrl);
      setSuccess("Logo uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleLogoRemove() {
    setError("");
    try {
      const res = await fetch("/api/configuration/company-logo", { method: "DELETE" });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body?.error?.message ?? "Remove failed.");
      setLogoUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess("Logo removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    }
  }

  function setField(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function setWorkingDay(day: string, value: boolean) {
    setValues((current) => ({ ...current, workingDays: { ...current.workingDays, [day]: value } }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const data = await apiPut<{ company: CompanyInfo }>("/api/configuration/company-information", values);
      setValues(valuesFromCompany(data.company));
      setSuccess("Company Information updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Company Information" description="Maintain the company profile used across LPG Management System documents and operational screens." />
      <form onSubmit={onSubmit} className="max-w-5xl space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        <FormSection title="Business Profile">
          {loading ? (
            <div className="text-sm text-slate-600">Loading...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Business / Company Name" required error={fieldErrors.legalName}>
                <input value={values.legalName} onChange={(event) => setField("legalName", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Trade Name">
                <input value={values.tradeName} onChange={(event) => setField("tradeName", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Owner / Contact Person">
                <input value={values.ownerName} onChange={(event) => setField("ownerName", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Phone">
                <input value={values.phone} onChange={(event) => setField("phone", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Email" error={fieldErrors.email}>
                <input value={values.email} onChange={(event) => setField("email", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="NTN / Tax Number">
                <input value={values.nationalTaxNumber} onChange={(event) => setField("nationalTaxNumber", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="GST Number">
                <input value={values.taxRegistrationNumber} onChange={(event) => setField("taxRegistrationNumber", event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Business Logo">
                <div className="flex items-start gap-4">
                  {logoUrl ? (
                    <div className="relative shrink-0">
                      <img src={logoUrl} alt="Business logo" className="h-16 w-auto max-w-[160px] rounded-md border border-slate-200 object-contain" />
                      <button type="button" onClick={handleLogoRemove} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white hover:bg-red-700" title="Remove logo">&times;</button>
                    </div>
                  ) : (
                    <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">No logo</div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-md bg-blue-950 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60">
                      {uploading ? "Uploading..." : "Upload Logo"}
                    </button>
                    <span className="text-[10px] text-slate-400">PNG, JPG, WEBP &middot; max 2 MB</span>
                  </div>
                </div>
              </Field>
              <Field label="Address">
                <textarea value={values.address} onChange={(event) => setField("address", event.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 md:col-span-2" />
              </Field>
            </div>
          )}
        </FormSection>
        <FormSection title="Operational Settings">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["stockAvailableCheck", "Stock Available Check"],
              ["centralizedPricing", "Centralized Pricing"],
              ["showDefaultDate", "Show Default Date"],
              ["redirectOnSamePage", "Redirect on Same Page After Save"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={values[key as keyof FormValues] === true}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [key]: event.target.checked }))
                  }
                  className="h-4 w-4 accent-blue-700"
                />
                {label}
              </label>
            ))}
            <Field label="Start Time">
              <input type="time" value={values.workStartTime} onChange={(e) => setField("workStartTime", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
            </Field>
            <Field label="End Time">
              <input type="time" value={values.workEndTime} onChange={(e) => setField("workEndTime", e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Working Days">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {days.map(([day, label]) => (
              <label key={day} className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm font-medium text-blue-950">
                <input type="checkbox" checked={values.workingDays[day] === true} onChange={(event) => setWorkingDay(day, event.target.checked)} className="h-4 w-4 accent-blue-700" />
                {label}
              </label>
            ))}
          </div>
        </FormSection>
        <button disabled={saving || loading} className="rounded-md bg-blue-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Save Company Information"}
        </button>
      </form>
    </>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block font-medium">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
