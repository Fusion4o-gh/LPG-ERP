import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const masterData = await import("../src/server/services/master-data/master-data.ts");

test.after(async () => prisma.$disconnect());

test("master forms preserve reference country, address, and item image fields", async () => {
  const base = await baseFixture(prisma);
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };

  const customer = await masterData.createCustomer(context, {
    code: doc("COUNTRY-C"),
    name: "Country Customer",
    address: "Primary address",
    address2: "Secondary address",
    country: "Pakistan",
  });
  const vendor = await masterData.createVendor(context, {
    code: doc("COUNTRY-V"),
    name: "Country Vendor",
    address: "Vendor address",
    address2: "Vendor address 2",
    country: "Pakistan",
  });

  assert.equal(customer.country, "Pakistan");
  assert.equal(customer.address2, "Secondary address");
  assert.equal(vendor.country, "Pakistan");
  assert.equal(vendor.address2, "Vendor address 2");

  const item = await masterData.createItem(context, {
    code: doc("IMAGE-ITEM"),
    name: "Image Item",
    categoryId: base.seedItem.categoryId,
    brandId: base.seedItem.brandId,
    imageData: "data:image/png;base64,AA==",
  });
  assert.equal(item.imageData, "data:image/png;base64,AA==");
});
