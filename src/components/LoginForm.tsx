"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="w-full max-w-sm space-y-6">
      {/* Company logo — bare, no container, swirl + fade in when it appears */}
      <AnimatePresence>
        {logoUrl && (
          <motion.img
            key="logo"
            src={logoUrl}
            alt="Company logo"
            className="mx-auto block object-contain"
            style={{ maxHeight: 112, width: "auto", maxWidth: "100%" }}
            initial={{ opacity: 0, scale: 0.7, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 180 }}
            transition={{ duration: 0.65, ease: [0.23, 1, 0.32, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Login card */}
      <motion.form
        onSubmit={submit}
        className="rounded-2xl p-7 space-y-4"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="text-center">
          <h1 className="text-xl font-bold text-gas-800">LPG Management</h1>
          <p className="mt-1 text-sm text-steel-500">Sign in to your account</p>
        </div>

        <ApiError message={error} />

        {companyName ? (
          <p className="text-center text-sm font-bold text-gas-700">{companyName}</p>
        ) : null}

        <label className="form-label">
          Login ID <span className="text-red-600">*</span>
          <input value={loginId} onChange={(event) => setLoginId(event.target.value)} className="form-input" />
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
                {year.label}{year.isActive ? " (active)" : ""}
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
      </motion.form>
    </div>
  );
}
