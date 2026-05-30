import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { adminDatabaseUrl, assertSafeTestDatabase, databaseName, resolveTestDatabaseUrl } from "../tests/helpers/test-database.mjs";

const repoRoot = resolve(import.meta.dirname, "..");

for (const name of [".env", ".env.local"]) {
  const path = resolve(repoRoot, name);
  if (existsSync(path)) loadEnvFile(path);
}

const devUrl = process.env.DATABASE_URL;
const testUrl = resolveTestDatabaseUrl();
assertSafeTestDatabase(testUrl, devUrl);

async function ensureDatabase() {
  const dbName = databaseName(testUrl);
  const admin = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl(testUrl) } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database ${dbName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
    console.log(`Database ${dbName} already exists`);
  } finally {
    await admin.$disconnect();
  }
}

function runPrisma(command) {
  execSync(command, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
  });
}

await ensureDatabase();
runPrisma("npx prisma migrate deploy");
runPrisma("node prisma/seed.js");
console.log(`Test database ready: ${databaseName(testUrl)}`);
