import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_METRICS = [
  "trialBalanceDifference",
  "customerLedgerDifference",
  "stockDifference",
  "customerCylinderDifference",
  "cashBankDifference",
  "dashboardDifference",
];

export function compareMigrationMetrics(expected, actual, tolerance = 0.01) {
  const failures = [];
  for (const metric of REQUIRED_METRICS) {
    const expectedValue = Number(expected?.[metric] ?? 0);
    const actualValue = Number(actual?.[metric] ?? 0);
    if (!Number.isFinite(expectedValue) || !Number.isFinite(actualValue)) {
      failures.push({ metric, reason: "metric is not numeric", expected: expectedValue, actual: actualValue });
      continue;
    }
    const difference = Math.abs(expectedValue - actualValue);
    if (difference > tolerance) failures.push({ metric, reason: `difference exceeds tolerance ${tolerance}`, expected: expectedValue, actual: actualValue, difference });
  }
  return { ok: failures.length === 0, tolerance, failures };
}

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

if (import.meta.url === `file://${process.argv[1].replaceAll("\\", "/")}`) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.expected || !args.actual) {
    console.error("Usage: node scripts/verify-legacy-migration.mjs --expected expected.json --actual actual.json [--tolerance 0.01]");
    process.exit(2);
  }
  const paths = [args.expected, args.actual].map((file) => resolve(file));
  if (paths.some((file) => !existsSync(file))) {
    console.error("Expected and actual metric files must both exist.");
    process.exit(2);
  }
  const result = compareMigrationMetrics(JSON.parse(readFileSync(paths[0], "utf8")), JSON.parse(readFileSync(paths[1], "utf8")), Number(args.tolerance ?? 0.01));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
