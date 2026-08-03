import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const importer = await import("../scripts/import-legacy-backup.mjs");
const verifier = await import("../scripts/verify-legacy-migration.mjs");

const fixtureDump = `
CREATE TABLE \`customer\` (\`id\` int, \`name\` varchar(50), \`note\` text);
INSERT INTO \`customer\` (\`id\`,\`name\`,\`note\`) VALUES (1,'A\\'s Gas','line 1'),(2,'B Gas',NULL);
CREATE TABLE \`chart_of_accounts\` (\`acode\` varchar(20), \`name\` varchar(50));
INSERT INTO \`chart_of_accounts\` VALUES ('2004002001','Trade Debtors');
`;

test("legacy dump parser reads schema, escaped strings, nulls, and multi-row inserts", () => {
  const tables = importer.parseMysqlDump(fixtureDump);
  assert.equal(tables.get("customer").rows.length, 2);
  assert.equal(tables.get("customer").rows[0][1], "A's Gas");
  assert.equal(tables.get("customer").rows[1][2], null);
  assert.deepEqual(tables.get("customer").columns, ["id", "name", "note"]);
});

test("legacy inspector maps known roles and remains write-disabled", () => {
  const result = importer.inspectDump(fixtureDump);
  assert.equal(result.tableCount, 2);
  assert.deepEqual(result.mappedRoles.customer, ["customer"]);
  assert.deepEqual(result.mappedRoles.chartAccount, ["chart_of_accounts"]);
  assert.equal(result.writeEnabled, false);
});

test("HTML backup-page downloads are rejected", () => {
  assert.throws(() => importer.parseMysqlDump("<!doctype html><html><body>Backup</body></html>"), /HTML/);
});

test("encoded backup payloads are rejected with an actionable message", () => {
  const encoded = Buffer.from("this is encrypted ciphertext and not SQL").toString("base64").repeat(40);
  assert.throws(() => importer.parseMysqlDump(encoded), /encoded or encrypted backup/i);
});

test("ZIP-wrapped backups are rejected with extraction guidance", () => {
  assert.throws(() => importer.parseMysqlDump("PK\u0003\u0004encrypted backup"), /ZIP archive.*Extract the SQL dump/i);
});

test("non-empty non-SQL payloads are rejected instead of appearing empty", () => {
  assert.throws(() => importer.parseMysqlDump("binary payload without a recognizable dump"), /does not contain recognizable MySQL/i);
});

test("legacy inspector CLI entrypoint is portable on Windows paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "lpg-legacy-cli-"));
  const dumpPath = join(directory, "fixture.sql");
  writeFileSync(dumpPath, fixtureDump, "utf8");
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/import-legacy-backup.mjs", import.meta.url)), "--dump", dumpPath], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"tableCount": 2/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migration reconciliation passes within tolerance and reports failures", () => {
  const expected = { trialBalanceDifference: 0, customerLedgerDifference: 1, stockDifference: 0, customerCylinderDifference: 0, cashBankDifference: 0, dashboardDifference: 0 };
  const actual = { trialBalanceDifference: 0.005, customerLedgerDifference: 1, stockDifference: 0, customerCylinderDifference: 0, cashBankDifference: 0, dashboardDifference: 0 };
  assert.equal(verifier.compareMigrationMetrics(expected, actual).ok, true);
  const failed = verifier.compareMigrationMetrics(expected, { ...actual, stockDifference: 2 });
  assert.equal(failed.ok, false);
  assert.equal(failed.failures[0].metric, "stockDifference");
});
