import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");

const purchaseRoute = await import("../src/app/api/purchases/filled-cylinder/route.ts");
const saleRoute = await import("../src/app/api/sales/lpg/route.ts");
const currentCompanyRoute = await import("../src/app/api/context/current-company/route.ts");

async function fixture() {
  return isolatedFixture(prisma, "API");
}

function jsonRequest(body) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function authedJsonRequest(body) {
  const { user } = await fixture();
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: JSON.stringify(body),
  });
}

async function authedGetRequest(url) {
  const { user } = await fixture();
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("API validation rejects invalid payloads before calling services", async () => {
  const response = await purchaseRoute.POST(await authedJsonRequest({ quantity: 0 }));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.ok(body.error.message);
});

test("API handlers call services successfully with valid payloads", async () => {
  const { item, vendor, customer } = await fixture();

  const purchaseResponse = await purchaseRoute.POST(
    await authedJsonRequest({
      vendorId: vendor.id,
      itemId: item.id,
      quantity: 1,
      unitCost: 2200,
      transactionDate: "2026-07-21",
    }),
  );
  const purchaseBody = await purchaseResponse.json();
  assert.equal(purchaseResponse.status, 200);
  assert.equal(purchaseBody.success, true);
  assert.match(purchaseBody.issueNo, /^PR-/);

  const saleResponse = await saleRoute.POST(
    await authedJsonRequest({
      customerId: customer.id,
      itemId: item.id,
      quantity: 1,
      unitPrice: 3100,
      transactionDate: "2026-07-21",
    }),
  );
  const saleBody = await saleResponse.json();
  assert.equal(saleResponse.status, 200);
  assert.equal(saleBody.success, true);
  assert.match(saleBody.issueNo, /^SI-/);
});

test("context API exposes the current company from centralized request context", async () => {
  const response = await currentCompanyRoute.GET(await authedGetRequest("http://localhost/api/context/current-company"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.company.id);
});
