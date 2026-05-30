/**
 * App theme system. Themes swap CSS custom properties defined in globals.css
 * via a `data-theme` attribute on <html>.
 *
 * Preference resolution order (before first paint):
 * 1. localStorage (`lpg-theme`)
 * 2. Cookie (`lpg-theme`) — synced from the signed-in user's DB preference
 * 3. `prefers-color-scheme: dark` → midnight, else aurora
 */

export const THEME_STORAGE_KEY = "lpg-theme";
export const THEME_COOKIE_KEY = "lpg-theme";

export type ThemeId = "aurora" | "midnight" | "graphite" | "emerald";

export const THEME_IDS: ThemeId[] = ["aurora", "midnight", "graphite", "emerald"];

export type ThemeDef = {
  id: ThemeId;
  name: string;
  description: string;
  tone: "light" | "dark";
  swatch: {
    page: string;
    sidebar: string;
    accent: string;
  };
};

export const THEMES: ThemeDef[] = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Bright, lively light interface with a soft blue glow. The default.",
    tone: "light",
    swatch: {
      page: "linear-gradient(135deg, #f4f7fd, #eef2fa)",
      sidebar: "linear-gradient(180deg, #ffffff, #eef4ff)",
      accent: "linear-gradient(135deg, #1d4ed8, #0477f2)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep navy navigation with a cyan accent. Classic, focused enterprise look.",
    tone: "dark",
    swatch: {
      page: "linear-gradient(135deg, #f1f5f9, #e8eef6)",
      sidebar: "linear-gradient(180deg, #0f172a, #0c1a36)",
      accent: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Neutral, understated corporate palette with a refined indigo accent.",
    tone: "light",
    swatch: {
      page: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
      sidebar: "#ffffff",
      accent: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Premium deep-green navigation with a fresh emerald accent.",
    tone: "dark",
    swatch: {
      page: "linear-gradient(135deg, #f3faf7, #edf6f1)",
      sidebar: "linear-gradient(180deg, #064e3b, #053b2e)",
      accent: "linear-gradient(135deg, #059669, #0d9488)",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "aurora";
export const SYSTEM_DARK_THEME: ThemeId = "midnight";
export const SYSTEM_LIGHT_THEME: ThemeId = "aurora";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function themeFromSystemPreference(isDark: boolean): ThemeId {
  return isDark ? SYSTEM_DARK_THEME : SYSTEM_LIGHT_THEME;
}

function readThemeCookie(): ThemeId | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE_KEY}=([^;]+)`));
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  return isThemeId(raw) ? raw : null;
}

/** Read the stored theme (client only). Falls back to cookie, then system preference. */
export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const fromStorage = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeId(fromStorage)) return fromStorage;
  const fromCookie = readThemeCookie();
  if (fromCookie) return fromCookie;
  if (typeof window.matchMedia === "function") {
    return themeFromSystemPreference(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  return DEFAULT_THEME;
}

export function themeCookieValue(theme: ThemeId) {
  return `${THEME_COOKIE_KEY}=${encodeURIComponent(theme)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
}

/** Apply a theme to the document and persist it locally. */
export function applyTheme(theme: ThemeId, options?: { writeCookie?: boolean }) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    if (options?.writeCookie !== false) {
      document.cookie = themeCookieValue(theme);
    }
  }
}

/** Inline script applied in root layout before first paint. */
export const THEME_INIT_SCRIPT = `(function(){var allowed=${JSON.stringify(THEME_IDS)};function valid(t){return t&&allowed.indexOf(t)!==-1;}try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(valid(t)){document.documentElement.dataset.theme=t;return;}var c=document.cookie.match(/(?:^|; )${THEME_COOKIE_KEY.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}=([^;]+)/);if(c&&valid(decodeURIComponent(c[1]))){document.documentElement.dataset.theme=decodeURIComponent(c[1]);return;}}catch(e){}var dark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=dark?${JSON.stringify(SYSTEM_DARK_THEME)}:${JSON.stringify(SYSTEM_LIGHT_THEME)};})();`;
