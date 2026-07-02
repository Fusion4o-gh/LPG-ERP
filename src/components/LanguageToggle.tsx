"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Interface language"
      className={`inline-flex items-center gap-0.5 rounded-full p-0.5 ${className}`}
      style={{ background: "rgba(0,0,0,0.06)" }}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
          language === "en" ? "text-white shadow-sm" : "text-steel-500 hover:text-steel-700"
        }`}
        style={language === "en" ? { background: "var(--flame-gradient)" } : undefined}
      >
        {t("English")}
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ur")}
        aria-pressed={language === "ur"}
        className={`gulzar-regular rounded-full px-3 py-1 text-xs font-semibold transition-all ${
          language === "ur" ? "text-white shadow-sm" : "text-steel-500 hover:text-steel-700"
        }`}
        style={language === "ur" ? { background: "var(--flame-gradient)" } : undefined}
      >
        {t("Urdu")}
      </button>
    </div>
  );
}
