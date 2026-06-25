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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
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
          setLogoUrl(body.logoUrl ?? null);
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
    <div className="flex flex-col items-center gap-5">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Business logo"
          className="w-full max-h-24 rounded-xl border border-slate-200/80 bg-white object-contain p-5 shadow-sm"
        />
      ) : null}
      <form onSubmit={submit} className="card-md w-full space-y-4 p-5">
        <ApiError message={error} />
        {companyName ? (
          <p className="text-center text-sm font-semibold text-slate-800">{companyName}</p>
        ) : null}
        <label className="form-label">
          Login ID <span className="text-red-600">*</span>
          <input
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            className="form-input"
          />
        </label>
        <label className="form-label">
          Financial Year <span className="text-red-600">*</span>
          <select
            value={financialYearId}
            onChange={(e) => setFinancialYearId(e.target.value)}
            className="form-input"
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
        <label className="form-label">
          Password <span className="text-red-600">*</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="form-input"
          />
        </label>
        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
    </div>
  );
}
