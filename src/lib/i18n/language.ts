export const LANGUAGE_STORAGE_KEY = "lpg-language";
export const LANGUAGE_COOKIE_KEY = "lpg-language";

export type Language = "en" | "ur";

export const LANGUAGES: Language[] = ["en", "ur"];
export const DEFAULT_LANGUAGE: Language = "en";

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGES.includes(value as Language);
}

function readLanguageCookie(): Language | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANGUAGE_COOKIE_KEY}=([^;]+)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isLanguage(raw) ? raw : null;
}

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const fromStorage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isLanguage(fromStorage)) return fromStorage;
  const fromCookie = readLanguageCookie();
  if (fromCookie) return fromCookie;
  return DEFAULT_LANGUAGE;
}

export function languageCookieValue(language: Language) {
  return `${LANGUAGE_COOKIE_KEY}=${encodeURIComponent(language)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
}

export function applyLanguage(language: Language, options?: { writeCookie?: boolean }) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language === "ur" ? "ur" : "en";
    document.documentElement.dataset.lang = language;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    if (options?.writeCookie !== false) {
      document.cookie = languageCookieValue(language);
    }
  }
}

export const LANGUAGE_INIT_SCRIPT = `(function(){var allowed=${JSON.stringify(LANGUAGES)};function valid(l){return l&&allowed.indexOf(l)!==-1;}var lang=${JSON.stringify(DEFAULT_LANGUAGE)};try{var s=localStorage.getItem(${JSON.stringify(LANGUAGE_STORAGE_KEY)});if(valid(s)){lang=s;}else{var c=document.cookie.match(/(?:^|; )${LANGUAGE_COOKIE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")}=([^;]+)/);if(c&&valid(decodeURIComponent(c[1]))){lang=decodeURIComponent(c[1]);}}}catch(e){}document.documentElement.lang=lang==="ur"?"ur":"en";document.documentElement.dataset.lang=lang;})();`;
