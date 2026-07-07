import assert from "node:assert/strict";
import test from "node:test";

const theme = await import("../src/lib/theme.ts");

test("isThemeId accepts known theme ids", () => {
  assert.equal(theme.isThemeId("gas"), true);
  assert.equal(theme.isThemeId("gas-amber"), true);
  assert.equal(theme.isThemeId("invalid"), false);
});

test("themeFromSystemPreference maps dark and light", () => {
  assert.equal(theme.themeFromSystemPreference(true), "gas");
  assert.equal(theme.themeFromSystemPreference(false), "gas");
});

test("themeCookieValue encodes theme for cookie storage", () => {
  assert.match(theme.themeCookieValue("gas-graphite"), /^lpg-theme=gas-graphite;/);
});

test("THEME_INIT_SCRIPT includes localStorage, cookie, and system preference fallbacks", () => {
  assert.match(theme.THEME_INIT_SCRIPT, /localStorage\.getItem\("lpg-theme"\)/);
  assert.match(theme.THEME_INIT_SCRIPT, /lpg-theme=/);
  assert.match(theme.THEME_INIT_SCRIPT, /"gas"/);
});

test("layout imports shared theme init script", async () => {
  const { readFile } = await import("node:fs/promises");
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /THEME_INIT_SCRIPT/);
  assert.match(layout, /@\/lib\/theme/);
});

test("user theme API route persists uiTheme", async () => {
  const { readFile } = await import("node:fs/promises");
  const route = await readFile(new URL("../src/app/api/user-preferences/theme/route.ts", import.meta.url), "utf8");
  assert.match(route, /uiTheme/);
  assert.match(route, /themeCookieValue/);
});

test("app shell context exposes themeId", async () => {
  const { readFile } = await import("node:fs/promises");
  const ctx = await readFile(new URL("../src/server/auth/app-shell-context.ts", import.meta.url), "utf8");
  assert.match(ctx, /themeId/);
  assert.match(ctx, /uiTheme/);
});

test("globals.css defines accent utility tokens", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /--gas-blue/);
  assert.match(css, /\.accent-tile/);
  assert.match(css, /\.accent-row-hover/);
});
