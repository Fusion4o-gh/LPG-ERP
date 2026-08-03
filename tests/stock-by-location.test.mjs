import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const report = await import("../src/server/services/reports/stock-by-location.ts");
test.after(async () => prisma.$disconnect());

test("stock by location reconciles filled and empty movements and exports CSV", async () => {
  const base = await baseFixture(prisma);
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, code: doc("SBL"), name: "Stock by Location Warehouse", type: "WAREHOUSE" } });
  await prisma.stockLedgerEntry.createMany({ data: [
    { companyId: base.company.id, financialYearId: base.financialYear.id, itemId: base.seedItem.id, cylinderState: "FILLED", direction: "IN", locationId: location.id, quantity: 10, balanceAfter: 10, sourceType: "OPENING_BALANCE", sourceId: doc("SBL-IN"), transactionDate: new Date("2026-08-01"), createdById: base.user.id },
    { companyId: base.company.id, financialYearId: base.financialYear.id, itemId: base.seedItem.id, cylinderState: "FILLED", direction: "OUT", locationId: location.id, quantity: 3, balanceAfter: 7, sourceType: "SALE_LPG", sourceId: doc("SBL-OUT"), transactionDate: new Date("2026-08-02"), createdById: base.user.id },
    { companyId: base.company.id, financialYearId: base.financialYear.id, itemId: base.seedItem.id, cylinderState: "EMPTY", direction: "IN", locationId: location.id, quantity: 4, balanceAfter: 4, sourceType: "CYLINDER_RETURN", sourceId: doc("SBL-EMPTY"), transactionDate: new Date("2026-08-02"), createdById: base.user.id },
  ] });
  const input = { companyId: base.company.id, financialYearId: base.financialYear.id, locationId: location.id };
  const rows = await prisma.$transaction((tx) => report.getStockByLocation(tx, input));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].filledQuantity, 7);
  assert.equal(rows[0].emptyQuantity, 4);
  const csv = await prisma.$transaction((tx) => report.getStockByLocationCsv(tx, input));
  assert.match(csv, /Location Code,Location,Item Code,Item,Filled Quantity,Empty Quantity/);
  assert.match(csv, new RegExp(`${location.code}.*7.*4`));
});
