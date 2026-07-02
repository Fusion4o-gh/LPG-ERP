"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ApiError } from "./ApiError";
import { SubmitButton } from "./SubmitButton";

type FinancialYear = { id: string; label: string; isActive: boolean };

export function LoginForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("");
  const [financialYearId, setFinancialYearId] = useState("");
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loginId.trim()) {
      setFinancialYears([]);
      setFinancialYearId("");
      setReady(true);
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
        .catch(() => undefined)
        .finally(() => setReady(true));
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
        throw new Error(body?.error?.message ?? t("Login failed."));
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Login failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      className="w-full max-w-sm space-y-6"
      initial={{ opacity: 0, y: 24 }}
      animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
    >
      {/* Company logo — appears in lockstep with the card via the shared `ready` gate above */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Company logo"
          className="mx-auto block object-contain"
          style={{ maxHeight: 176, width: "auto", maxWidth: "100%" }}
        />
      )}

      {/* Login card */}
      <form
        onSubmit={submit}
        className="rounded-2xl p-7 space-y-4"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div className="text-center">
          <h1 className="text-xl font-bold text-gas-800">{t("LPG Management")}</h1>
          <p className="mt-1 text-sm text-steel-500">{t("Sign in to your account")}</p>
        </div>

        <ApiError message={error} />

        {companyName ? (
          <p className="text-center text-sm font-bold text-gas-700">{companyName}</p>
        ) : null}

        <label className="form-label">
          {t("Login ID")} <span className="text-red-600">*</span>
          <input value={loginId} onChange={(event) => setLoginId(event.target.value)} className="form-input" />
        </label>

        <label className="form-label">
          {t("Financial Year")} <span className="text-red-600">*</span>
          <select
            value={financialYearId}
            onChange={(e) => setFinancialYearId(e.target.value)}
            className="form-input"
            required
            disabled={financialYears.length === 0}
          >
            <option value="">{financialYears.length ? t("Select financial year") : t("Enter login ID first")}</option>
            {financialYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}{year.isActive ? ` ${t("(active)")}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="form-label">
          {t("Password")} <span className="text-red-600">*</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="form-input"
          />
        </label>

        <SubmitButton loading={loading}>{t("Sign in")}</SubmitButton>
      </form>
    </motion.div>
  );
}
