"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ApiError } from "@/components/ApiError";
import { apiPut } from "@/lib/api-client";
import { applyTheme, getStoredTheme, THEMES, type ThemeId } from "@/lib/theme";

function ThemePreview({ theme }: { theme: (typeof THEMES)[number] }) {
  return (
    <div
      className="relative h-28 w-full overflow-hidden rounded-lg border border-slate-200"
      style={{ background: theme.swatch.page }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-y-0 left-0 w-1/3 border-r border-black/5"
        style={{ background: theme.swatch.sidebar }}
      >
        <div className="space-y-1.5 p-2">
          <div className="h-2.5 w-2.5 rounded" style={{ background: theme.swatch.accent }} />
          <div className={`h-1.5 w-10 rounded-full ${theme.tone === "dark" ? "bg-white/30" : "bg-slate-300"}`} />
          <div className={`h-1.5 w-8 rounded-full ${theme.tone === "dark" ? "bg-white/20" : "bg-slate-200"}`} />
          <div className={`h-1.5 w-9 rounded-full ${theme.tone === "dark" ? "bg-white/20" : "bg-slate-200"}`} />
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 left-1/3 space-y-2 p-3">
        <div className="h-5 w-full rounded" style={{ background: theme.swatch.accent }} />
        <div className="flex gap-1.5">
          <div className="h-7 flex-1 rounded bg-white/80 shadow-sm" />
          <div className="h-7 flex-1 rounded bg-white/80 shadow-sm" />
        </div>
        <div className="h-2 w-2/3 rounded-full bg-white/70" />
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function AppearancePage() {
  const [active, setActive] = useState<ThemeId | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setActive(getStoredTheme());
  }, []);

  async function choose(theme: ThemeId) {
    setError("");
    setSaving(true);
    applyTheme(theme);
    setActive(theme);
    try {
      await apiPut("/api/user-preferences/theme", { theme });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save theme preference.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Appearance"
        description="Choose a theme for the interface. Your selection is saved to your account and syncs across devices."
      />

      <ApiError message={error} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {THEMES.map((theme) => {
          const isActive = active === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => choose(theme.id)}
              disabled={saving}
              aria-pressed={isActive}
              className={`card surface-press group relative rounded-xl p-3 text-left transition-all ${
                isActive ? "ring-2 ring-offset-2" : "hover:border-slate-300 hover:shadow-md"
              }`}
              style={
                isActive
                  ? ({ boxShadow: "var(--card-shadow-md)", "--tw-ring-color": "var(--fusion-blue)" } as React.CSSProperties)
                  : undefined
              }
            >
              <ThemePreview theme={theme} />

              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{theme.name}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{theme.description}</p>
                </div>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white transition-all ${
                    isActive ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                  style={{ background: "var(--fusion-gradient)" }}
                >
                  <CheckIcon />
                </span>
              </div>

              <span
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  theme.tone === "dark" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
                }`}
              >
                {theme.tone === "dark" ? "Dark sidebar" : "Light sidebar"}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-slate-400">
        On first visit, the app follows your system light/dark preference until you choose a theme. Module colors stay
        consistent so you can always navigate by color.
      </p>
    </>
  );
}
