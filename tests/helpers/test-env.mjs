import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { assertSafeTestDatabase, resolveTestDatabaseUrl, SEED_COMPANY_NAME } from "./test-database.mjs";

export { SEED_COMPANY_NAME };

const repoRoot = resolve(import.meta.dirname, "../..");

for (const name of [".env", ".env.local"]) {
  const path = resolve(repoRoot, name);
  if (existsSync(path)) loadEnvFile(path);
}

const devUrl = process.env.DATABASE_URL;
const testUrl = resolveTestDatabaseUrl();
assertSafeTestDatabase(testUrl, devUrl);
process.env.DATABASE_URL = testUrl;
process.env.DATABASE_URL_TEST = testUrl;
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.ALLOW_TEST_AUTH = "1";
