import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { isolatedFixture } from "./helpers/lpg-fixtures.mjs";
import { createSession } from "../src/server/auth/session.ts";

const prisma = new PrismaClient();
const itemPriceRoute = await import("../src/app/api/items/[id]/price/route.ts");

test.after(async () => {
  await prisma.$disconnect();
});

test("item Define Prices workflow lists and saves default and customer prices", async () => {
  const { item, customer, user } = await isolatedFixture(prisma, "PRICE");
  await prisma.item.update({ where: { id: item.id }, data: { cylinderWeightKg: 11.8 } });
  const session = await createSession(user.id);
  const request = (body) => new Request(`http://localhost/api/items/${item.id}/price`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: JSON.stringify(body),
  });

  const defaultResponse = await itemPriceRoute.PATCH(request({ price: 2500, pricePerKg: 211.8644, validFrom: "2026-08-02" }), { params: Promise.resolve({ id: item.id }) });
  assert.equal(defaultResponse.status, 200);
  const defaultBody = await defaultResponse.json();
  const customerResponse = await itemPriceRoute.PATCH(request({ customerId: customer.id, price: 2600, validFrom: "2026-08-02" }), { params: Promise.resolve({ id: item.id }) });
  assert.equal(customerResponse.status, 200);
  const customerBody = await customerResponse.json();

  const listResponse = await itemPriceRoute.GET(new Request(`http://localhost/api/items/${item.id}/price`, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } }), { params: Promise.resolve({ id: item.id }) });
  const body = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(body.prices.length, 2);
  assert.ok(body.prices.some((price) => price.customerId === customer.id && price.price === "2600"));
  assert.ok(body.prices.some((price) => price.customerId === null && price.pricePerKg === "211.8644"));
  const priceAudit = await prisma.auditLog.findMany({ where: { userId: user.id, entityType: "ItemPrice", entityId: { in: [defaultBody.itemPrice.id, customerBody.itemPrice.id] } }, orderBy: { createdAt: "asc" } });
  assert.equal(priceAudit.length, 2);
  assert.deepEqual(priceAudit.map((entry) => entry.action), ["CREATE", "CREATE"]);
});

test("item Define Prices rejects a cross-company customer and invalid date range", async () => {
  const { item, user } = await isolatedFixture(prisma, "PRICE-GUARD");
  const session = await createSession(user.id);
  const response = await itemPriceRoute.PATCH(new Request(`http://localhost/api/items/${item.id}/price`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: JSON.stringify({ customerId: "not-owned", price: 100, validFrom: "2026-08-03", validTo: "2026-08-02" }),
  }), { params: Promise.resolve({ id: item.id }) });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error.message, /Customer not found|validTo/i);
});
