import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    args[key] = argv[index + 1]?.startsWith("--") ? true : argv[++index];
  }
  return args;
}

export function extractNavigationRoutes(source) {
  const visibleSource = source.split("export const PENDING_NAV", 1)[0];
  return [...visibleSource.matchAll(/href:\s*["'](\/[^"']+)["']/g)]
    .map((match) => match[1].split(/[?#]/, 1)[0])
    .filter((route) => route !== "/")
    .filter((route, index, routes) => routes.indexOf(route) === index);
}

function cookieHeader(response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

export async function smokeLocalRoutes({ baseUrl, loginId, password, routes, timeoutMs = 15000, concurrency = 6 }) {
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId, password }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!login.ok) throw new Error(`Local login failed with HTTP ${login.status}.`);
  const cookie = cookieHeader(login);
  if (!cookie) throw new Error("Local login did not return a session cookie.");

  const results = [];
  for (let index = 0; index < routes.length; index += concurrency) {
    const batch = routes.slice(index, index + concurrency);
    const batchResults = await Promise.all(batch.map(async (route) => {
      try {
        const response = await fetch(`${baseUrl}${route}`, {
          headers: { cookie },
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
        return { route, status: response.status, location: response.headers.get("location") ?? "" };
      } catch (error) {
        return { route, status: 0, location: error instanceof Error ? error.message : String(error) };
      }
    }));
    results.push(...batchResults);
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = String(args.base ?? "http://localhost:3002").replace(/\/$/, "");
  const loginId = String(args.login ?? process.env.SMOKE_LOGIN_ID ?? "");
  const password = String(args.password ?? process.env.SMOKE_PASSWORD ?? "");
  if (!loginId || !password) {
    console.error("Usage: npm run smoke:local -- --login <id> --password <password> [--base http://localhost:3002]");
    process.exit(2);
  }

  const source = await readFile(new URL("../src/lib/navigation/modules.ts", import.meta.url), "utf8");
  const routes = args.routes ? String(args.routes).split(",").map((route) => route.trim()).filter(Boolean) : extractNavigationRoutes(source);
  const results = await smokeLocalRoutes({
    baseUrl,
    loginId,
    password,
    routes,
    timeoutMs: Number(args.timeout ?? 15000),
    concurrency: Number(args.concurrency ?? 6),
  });
  const failures = results.filter((result) => result.status !== 200);
  console.log(JSON.stringify({ baseUrl, routeCount: results.length, failures, results }, null, 2));
  if (failures.length > 0) process.exit(1);
}
