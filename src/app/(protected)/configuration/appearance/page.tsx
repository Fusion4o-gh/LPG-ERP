"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ApiError } from "@/components/ApiError";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { apiPut } from "@/lib/api-client";
import { applyTheme, getStoredTheme, THEMES, type ThemeId } from "@/lib/theme";

function ThemePreview({ theme }: { theme: (typeof THEMES)[number] }) {
  return (
    <div
      className="relative h-28 w-full overflow-hidden rounded-lg"
      style={{ background: theme.swatch.page, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-y-0 left-0 w-1/3"
        style={{ background: theme.swatch.sidebar, borderRight: '1px solid rgba(0,0,0,0.2)' }}
      >
        <div className="space-y-1.5 p-2">
          <div className="h-2.5 w-2.5 rounded" style={{ background: theme.swatch.accent, boxShadow: '1px 1px 2px rgba(0,0,0,0.2)' }} />
          <div className="h-1.5 w-10 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />
          <div className="h-1.5 w-8 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <div className="h-1.5 w-9 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 left-1/3 space-y-2 p-3">
        <div className="h-5 w-full rounded" style={{ background: theme.swatch.accent, boxShadow: '1px 1px 3px rgba(0,0,0,0.15)' }} />
        <div className="flex gap-1.5">
          <div className="h-7 flex-1 rounded" style={{ background: 'var(--skeu-raised)', boxShadow: 'var(--skeu-shadow-sm)' }} />
          <div className="h-7 flex-1 rounded" style={{ background: 'var(--skeu-raised)', boxShadow: 'var(--skeu-shadow-sm)' }} />
        </div>
        <div className="h-2 w-2/3 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }} />
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
  const { t } = useLanguage();

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
        title={t("Appearance")}
        description={t(
          "Choose an accent color for the interface. All themes use the deep gas blue sidebar with skeuomorphic raised surfaces."
        )}
      />

      <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
        <div>
          <p className="text-sm font-bold text-gas-800">{t("Language")}</p>
          <p className="mt-0.5 text-xs leading-snug text-steel-500">
            {t("Choose the interface language. Urdu translates menus, navigation, and labels across the app.")}
          </p>
        </div>
        <LanguageToggle />
      </div>

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
              className="card surface-press group relative rounded-xl p-3 text-left transition-all"
              style={isActive ? { boxShadow: '0 0 0 2px var(--flame-orange), var(--skeu-shadow-lg)' } : {}}
            >
              <ThemePreview theme={theme} />

              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gas-800">{theme.name}</p>
                  <p className="mt-0.5 text-xs leading-snug text-steel-500">{theme.description}</p>
                </div>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white transition-all ${
                    isActive ? "scale-100 opacity-100" : "scale-75 opacity-0"
                  }`}
                  style={{ background: 'var(--flame-gradient)', boxShadow: '1px 1px 3px rgba(0,0,0,0.2)' }}
                >
                  <CheckIcon />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-steel-400">
        {t("Accent color only affects module tab bars and accent highlights. The sidebar and main surfaces remain consistent.")}
      </p>
    </>
  );
}
