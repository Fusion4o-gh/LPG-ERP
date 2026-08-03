import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const dollars = await import("../src/server/services/dollar/dollar-transactions.ts");
const reports = await import("../src/server/services/reports/dollar-reports.ts");
test.after(async () => prisma.$disconnect());

test("dollar ledger report filters transactions and exports CSV", async () => {
  const base = await baseFixture(prisma); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("DR"), name: doc("Report Product") } }); const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("DRLOC"), name: doc("Report Location"), type: "PLANT" } });
  const row = await dollars.createDollarTransaction(context, { txnType: "PURCHASE", vendorId: base.seedVendor.id, productId: product.id, locationId: location.id, quantity: 1, usdAmount: 100, exchangeRate: 280, transactionDate: "2026-08-02" }); const report = await reports.getDollarLedgerReport(context, { from: "2026-08-01", to: "2026-08-03" }); assert.ok(report.rows.some((entry) => entry.id === row.id)); const csv = await reports.getDollarLedgerReportCsv(context, { txnType: "PURCHASE" }); assert.match(csv, /Document,Type,Date/); assert.match(csv, /DP-/);
});
