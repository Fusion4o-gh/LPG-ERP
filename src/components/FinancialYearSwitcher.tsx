"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api-client";

type FinancialYear = { id: string; label: string; isActive: boolean };

export function FinancialYearSwitcher({ currentLabel }: { currentLabel: string }) {
  const router = useRouter();
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<{ financialYear: FinancialYear; financialYears: FinancialYear[] }>("/api/context/active-financial-year")
      .then((data) => {
        setYears(data.financialYears);
        setCurrentId(data.financialYear.id);
      })
      .catch(() => undefined);
  }, [currentLabel]);

  async function onChange(financialYearId: string) {
    if (!financialYearId || financialYearId === currentId) return;
    setSaving(true);
    try {
      await apiPut("/api/context/active-financial-year", { financialYearId });
      setCurrentId(financialYearId);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (years.length <= 1) {
    return (
      <span className="hidden rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 sm:inline" title="Active financial year">
        FY {currentLabel}
      </span>
    );
  }

  return (
    <label className="hidden items-center gap-1.5 sm:flex">
      <span className="text-[11px] font-medium text-slate-500">FY</span>
      <select
        value={currentId}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-blue-100 bg-blue-50 px-2 text-xs font-semibold text-blue-900"
        aria-label="Financial year"
      >
        {years.map((year) => (
          <option key={year.id} value={year.id}>
            {year.label}
          </option>
        ))}
      </select>
    </label>
  );
}
