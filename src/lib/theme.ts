export const THEME_STORAGE_KEY = "lpg-theme";
export const THEME_COOKIE_KEY = "lpg-theme";

export type ThemeId = "gas" | "gas-amber" | "gas-graphite" | "gas-emerald";

export const THEME_IDS: ThemeId[] = ["gas", "gas-amber", "gas-graphite", "gas-emerald"];

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
    id: "gas",
    name: "Gas Blue",
    description: "Deep gas blue sidebar with LPG orange accents. The default.",
    tone: "dark",
    swatch: {
      page: "linear-gradient(145deg, #FAFAF7, #f0f0ea)",
      sidebar: "linear-gradient(180deg, #0C2845, #123A5A, #0F3150)",
      accent: "linear-gradient(135deg, #F28C28, #D97823)",
    },
  },
  {
    id: "gas-amber",
    name: "Amber Glow",
    description: "Warm amber-orange highlights on deep blue. High energy.",
    tone: "dark",
    swatch: {
      page: "linear-gradient(145deg, #FAFAF7, #f0f0ea)",
      sidebar: "linear-gradient(180deg, #0C2845, #123A5A, #0F3150)",
      accent: "linear-gradient(135deg, #F9A825, #F28C28)",
    },
  },
  {
    id: "gas-graphite",
    name: "Steel Graphite",
    description: "Neutral steel accent on deep blue. Understated corporate.",
    tone: "dark",
    swatch: {
      page: "linear-gradient(145deg, #FAFAF7, #f0f0ea)",
      sidebar: "linear-gradient(180deg, #0C2845, #123A5A, #0F3150)",
      accent: "linear-gradient(135deg, #4B5563, #6B7280)",
    },
  },
  {
    id: "gas-emerald",
    name: "Emerald Gas",
    description: "Premium emerald accent on deep blue.",
    tone: "dark",
    swatch: {
      page: "linear-gradient(145deg, #FAFAF7, #f0f0ea)",
      sidebar: "linear-gradient(180deg, #0C2845, #123A5A, #0F3150)",
      accent: "linear-gradient(135deg, #2E7D32, #388E3C)",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "gas";
export const SYSTEM_DARK_THEME: ThemeId = "gas";
export const SYSTEM_LIGHT_THEME: ThemeId = "gas";

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

export const THEME_INIT_SCRIPT = `(function(){var allowed=${JSON.stringify(THEME_IDS)};function valid(t){return t&&allowed.indexOf(t)!==-1;}try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(valid(t)){document.documentElement.dataset.theme=t;return;}var c=document.cookie.match(/(?:^|; )${THEME_COOKIE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")}=([^;]+)/);if(c&&valid(decodeURIComponent(c[1]))){document.documentElement.dataset.theme=decodeURIComponent(c[1]);return;}}catch(e){}document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_THEME)};})();`;
