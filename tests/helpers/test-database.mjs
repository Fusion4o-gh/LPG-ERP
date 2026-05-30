export const SEED_COMPANY_NAME = "LPG Management System";
export const SEED_ADMIN_PASSWORD = "4784Shani";
export const DEFAULT_TEST_DB = "lpg_management_system_test";

export function resolveTestDatabaseUrl(env = process.env) {
  if (env.DATABASE_URL_TEST?.trim()) return env.DATABASE_URL_TEST.trim();
  const devUrl = env.DATABASE_URL?.trim();
  if (!devUrl) {
    throw new Error("Set DATABASE_URL (dev) and optionally DATABASE_URL_TEST before running tests.");
  }
  const url = new URL(devUrl.replace(/^postgresql:/i, "postgres:"));
  url.pathname = `/${DEFAULT_TEST_DB}`;
  return url.toString().replace(/^postgres:/i, "postgresql:");
}

export function databaseName(connectionUrl) {
  const url = new URL(connectionUrl.replace(/^postgresql:/i, "postgres:"));
  return decodeURIComponent(url.pathname.replace(/^\//, "").split("/")[0] || "");
}

export function assertSafeTestDatabase(testUrl, devUrl = process.env.DATABASE_URL) {
  const testDb = databaseName(testUrl);
  if (!testDb) throw new Error("Test DATABASE_URL must include a database name.");
  if (!/test/i.test(testDb)) {
    throw new Error(
      `Refusing to run tests against "${testDb}". The database name must contain "test" (e.g. ${DEFAULT_TEST_DB}).`,
    );
  }
  if (devUrl) {
    const devDb = databaseName(devUrl);
    if (devDb && devDb === testDb) {
      throw new Error(`DATABASE_URL_TEST must not point at the dev database "${devDb}".`);
    }
  }
}

export function adminDatabaseUrl(connectionUrl) {
  const url = new URL(connectionUrl.replace(/^postgresql:/i, "postgres:"));
  url.pathname = "/postgres";
  return url.toString().replace(/^postgres:/i, "postgresql:");
}
