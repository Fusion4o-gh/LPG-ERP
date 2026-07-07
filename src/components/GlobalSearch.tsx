"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type SearchResult = { type: string; label: string; subtitle: string; href: string };

export function GlobalSearch() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.results);
        setOpen(data.results.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative hidden lg:block">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={t("Search customers, vouchers…")}
        className="h-8 w-64 rounded-lg px-3 pl-9 text-sm text-steel-600 placeholder:text-steel-400"
        style={{ background: "var(--skeu-input)", boxShadow: "var(--skeu-shadow-inset-sm), 0 0 0 1px rgba(0,0,0,0.04)" }}
        aria-label="Global search"
        aria-expanded={open}
        aria-controls="global-search-results"
      />
      {open ? (
        <div
          id="global-search-results"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          {loading ? <p className="px-3 py-2 text-xs text-slate-500">Searching…</p> : null}
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((result) => (
              <li key={`${result.type}-${result.href}-${result.label}`}>
                <Link
                  href={result.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 hover:bg-slate-50"
                >
                  <p className="text-sm font-medium text-slate-900">{result.label}</p>
                  <p className="text-xs text-slate-500">
                    {result.type} · {result.subtitle}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
