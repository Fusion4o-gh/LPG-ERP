import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const purchaseRoute = await import("../src/app/api/purchases/filled-cylinder/route.ts");
const saleRoute = await import("../src/app/api/sales/lpg/route.ts");
const documentRoute = await import("../src/app/api/transaction-documents/[documentType]/[documentNo]/route.ts");

const root = new URL("../", import.meta.url);

async function file(path) {
  return readFile(new URL(path, root), "utf8");
}

async function authedRequest(user, url = "http://localhost/api/test") {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

async function authedJsonRequest(user, body) {
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: JSON.stringify(body),
  });
}

async function createSaleDocument() {
  const { item, customer, vendor, user } = await isolatedFixture(prisma, "DOC");
  const purchaseResponse = await purchaseRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      itemId: item.id,
      quantity: 2,
      unitCost: 2200,
      transactionDate: "2026-07-21",
    }),
  );
  assert.equal(purchaseResponse.status, 200);

  const response = await saleRoute.POST(
    await authedJsonRequest(user, {
      customerId: customer.id,
      itemId: item.id,
      quantity: 2,
      unitPrice: 3100,
      transactionDate: "2026-07-21",
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  return { user, issueNo: body.issueNo };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("transaction document read API returns printable payload with metadata", async () => {
  const { user, issueNo } = await createSaleDocument();
  const response = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "sale-lpg", documentNo: issueNo }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.document.heading, "LPG ERP");
  assert.equal(body.document.type, "Sale LPG Invoice");
  assert.equal(body.document.number, issueNo);
  assert.equal(body.document.date, "2026-07-21");
  assert.ok(body.document.lineItems.length > 0);
  assert.ok(body.document.voucherLines.length > 0);
  assert.ok(body.document.generatedAt);
});

test("transaction document read API denies unauthenticated access", async () => {
  const response = await documentRoute.GET(new Request("http://localhost/api/transaction-documents/sale-lpg/SI-1"), {
    params: Promise.resolve({ documentType: "sale-lpg", documentNo: "SI-1" }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "UNAUTHORIZED");
});

test("printable transaction pages and component render document number and type metadata", async () => {
  const component = await file("src/components/PrintableTransactionDocument.tsx");
  const salePage = await file("src/app/(protected)/operations/sale-lpg/print/[documentNo]/page.tsx");
  const securityPage = await file("src/app/(protected)/payments/security-receipt/print/[documentNo]/page.tsx");

  assert.match(component, /Document Number/);
  assert.match(component, /document\.type/);
  assert.match(component, /document\.generatedAt/);
  assert.match(component, /window\.print\(\)/);
  assert.match(component, /data-print-hidden/);
  assert.match(salePage, /documentType="sale-lpg"/);
  assert.match(securityPage, /documentType="security-receipt"/);
});
