"use client";

import { FormEvent, useEffect, useState } from "react";
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

  useEffect(() => {
    apiGet<{ company: CompanyInfo }>("/api/configuration/company-information")
      .then((data) => setValues(valuesFromCompany(data.company)))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
      <PageHeader title="Company Information" description="Maintain the company profile used across LPG ERP documents and operational screens." />
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
              <Field label="Logo Path / Upload">
                <input value="Upload pending" disabled className="w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500" />
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
