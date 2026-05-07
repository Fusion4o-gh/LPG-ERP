import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);

async function schema() {
  return readFile(schemaPath, "utf8");
}

test("Prisma schema contains LPG distribution foundation models", async () => {
  const text = await schema();
  const requiredModels = [
    "Company",
    "FinancialYear",
    "User",
    "Role",
    "Permission",
    "ChartAccount",
    "Customer",
    "Vendor",
    "Item",
    "StockLedgerEntry",
    "AccountingVoucher",
    "AccountingVoucherLine",
    "AuditLog",
  ];

  for (const model of requiredModels) {
    assert.match(text, new RegExp(`model\\s+${model}\\s+\\{`));
  }
});

test("Prisma schema captures cylinder accountability and immutable ledgers", async () => {
  const text = await schema();

  assert.match(text, /enum\s+CylinderState\s+\{[\s\S]*FILLED[\s\S]*EMPTY[\s\S]*\}/);
  assert.match(text, /model\s+StockLedgerEntry\s+\{[\s\S]*customerId[\s\S]*vendorId[\s\S]*quantity[\s\S]*balanceAfter[\s\S]*sourceType[\s\S]*sourceId[\s\S]*\}/);
  assert.match(text, /model\s+CustomerCylinderBalance\s+\{[\s\S]*filledOutstanding[\s\S]*emptyOwed[\s\S]*securityHeld[\s\S]*\}/);
});

test("Prisma schema supports balanced accounting vouchers and audit traceability", async () => {
  const text = await schema();

  assert.match(text, /model\s+AccountingVoucherLine\s+\{[\s\S]*debit[\s\S]*credit[\s\S]*accountId[\s\S]*\}/);
  assert.match(text, /model\s+AuditLog\s+\{[\s\S]*action[\s\S]*entityType[\s\S]*entityId[\s\S]*before[\s\S]*after[\s\S]*\}/);
  assert.match(text, /model\s+FinancialYear\s+\{[\s\S]*isActive[\s\S]*isClosed[\s\S]*\}/);
});
