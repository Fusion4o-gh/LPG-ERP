import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const search = await import("../src/server/services/search/global-search.ts");

test.after(async () => prisma.$disconnect());

test("global search returns customer, item, bulk product, and voucher results", async () => {
  const base = await baseFixture(prisma);
  const query = base.seedCustomer.code;
  const results = await search.globalSearch({ companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }, query);
  assert.ok(results.some((result) => result.type === "Customer" && result.label.includes(query)));

  const itemResults = await search.globalSearch({ companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }, base.seedItem.code);
  assert.ok(itemResults.some((result) => result.type === "Item"));

  const bulk = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: `B-${doc("SEARCH")}`, name: "Search Bulk Product", unit: "MT" } });
  const bulkResults = await search.globalSearch({ companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }, bulk.code);
  assert.ok(bulkResults.some((result) => result.type === "Bulk Product"));
});

