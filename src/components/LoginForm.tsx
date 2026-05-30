"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "./ApiError";
import { SubmitButton } from "./SubmitButton";

type FinancialYear = { id: string; label: string; isActive: boolean };

export function LoginForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("");
  const [financialYearId, setFinancialYearId] = useState("");
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loginId.trim()) {
      setFinancialYears([]);
      setFinancialYearId("");
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/auth/login-options?loginId=${encodeURIComponent(loginId.trim())}`)
        .then((res) => res.json())
        .then((body) => {
          if (!body.success || !body.found) {
            setFinancialYears([]);
            setCompanyName("");
            return;
          }
          setFinancialYears(body.financialYears ?? []);
          setCompanyName(body.companyName ?? "");
          setFinancialYearId(body.defaultFinancialYearId ?? body.financialYears?.[0]?.id ?? "");
        })
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [loginId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ loginId, password, financialYearId: financialYearId || undefined }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) {
        throw new Error(body?.error?.message ?? "Login failed.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <ApiError message={error} />
      {companyName ? <p className="text-sm font-medium text-slate-700">{companyName}</p> : null}
      <label className="block text-sm font-medium text-slate-700">
        Login ID <span className="text-red-600">*</span>
        <input value={loginId} onChange={(event) => setLoginId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Financial Year <span className="text-red-600">*</span>
        <select
          value={financialYearId}
          onChange={(e) => setFinancialYearId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          required
          disabled={financialYears.length === 0}
        >
          <option value="">{financialYears.length ? "Select financial year" : "Enter login ID first"}</option>
          {financialYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.label}
              {year.isActive ? " (active)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password <span className="text-red-600">*</span>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <SubmitButton loading={loading}>Login</SubmitButton>
    </form>
  );
}
