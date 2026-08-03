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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

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
        setOpen(true);
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
    <div ref={containerRef} className="relative w-full">
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={t("Search customers, vouchers…")}
        className="form-input !mt-0 h-8 w-full !rounded-md pl-8 text-sm"
        aria-label="Global search"
        aria-describedby="global-search-hint"
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
      />
      <span id="global-search-hint" className="sr-only">Press Control K or Command K to focus search. Press Escape to close results.</span>
      {open ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-[var(--surface-border)] bg-white shadow-soft-md"
        >
          {loading ? <p className="px-3 py-2 text-xs text-steel-500">Searching…</p> : null}
          {!loading && results.length === 0 ? <p className="px-3 py-2 text-xs text-steel-500">No matching records.</p> : null}
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((result) => (
              <li key={`${result.type}-${result.href}-${result.label}`} role="option">
                <Link
                  href={result.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 skeu-dropdown-item"
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
