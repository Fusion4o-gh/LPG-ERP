import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const purchaseRoute = await import("../src/app/api/purchases/filled-cylinder/route.ts");
const saleRoute = await import("../src/app/api/sales/lpg/route.ts");
const cylinderReturnRoute = await import("../src/app/api/returns/cylinder/route.ts");
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
  assert.equal(body.document.heading, "LPG Management System");
  assert.equal(body.document.type, "Sale LPG Invoice");
  assert.equal(body.document.number, issueNo);
  assert.equal(body.document.date, "2026-07-21");
  assert.ok(body.document.lineItems.length > 0);
  assert.ok(body.document.voucherLines.length > 0);
  assert.ok(body.document.generatedAt);
});

test("purchase print payload includes every GIRN line with calculated amounts", async () => {
  const { company, financialYear, item, seedItem, vendor, user } = await isolatedFixture(prisma, "DOC-PUR");
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `DOC-PUR-ITEM-${Date.now()}`,
      name: "Printable Purchase Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  const response = await purchaseRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      transactionDate: "2026-07-22",
      remarks: "Printable multi-line purchase",
      lines: [
        { itemId: item.id, cylinderState: "FILLED", quantity: 2, unitCost: 2000, gstPercent: 10 },
        { itemId: secondItem.id, cylinderState: "FILLED", quantity: 1, unitCost: 1000, gstPercent: 5 },
      ],
    }),
  );
  const purchaseBody = await response.json();
  assert.equal(response.status, 200);

  const printResponse = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "purchase-filled-cylinder", documentNo: purchaseBody.issueNo }),
  });
  const body = await printResponse.json();

  assert.equal(printResponse.status, 200);
  assert.equal(body.document.lineItems.length, 2);
  assert.equal(body.document.lineItems[0].exGstAmount, "4000");
  assert.equal(body.document.lineItems[0].gstAmount, "400");
  assert.equal(body.document.lineItems[0].incGstAmount, "4400");
  assert.equal(body.document.totals.totalDebit, "5450");
});

test("sale print payload includes every LPG invoice line with selected invoice language", async () => {
  const { company, financialYear, item, seedItem, vendor, customer, user } = await isolatedFixture(prisma, "DOC-SALE");
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `DOC-SALE-ITEM-${Date.now()}`,
      name: "Printable Sale Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await purchaseRoute.POST(
    await authedJsonRequest(user, {
      vendorId: vendor.id,
      transactionDate: "2026-07-22",
      lines: [
        { itemId: item.id, cylinderState: "FILLED", quantity: 3, unitCost: 2000 },
        { itemId: secondItem.id, cylinderState: "FILLED", quantity: 2, unitCost: 1000 },
      ],
    }),
  );

  const response = await saleRoute.POST(
    await authedJsonRequest(user, {
      customerId: customer.id,
      transactionDate: "2026-07-22",
      invoiceLanguage: "Urdu",
      lines: [
        { itemId: item.id, quantity: 2, unitPrice: 3000, gstPercent: 10, securityDepositAmount: 500 },
        { itemId: secondItem.id, quantity: 1, unitPrice: 2000, gstPercent: 5, securityDepositAmount: 250 },
      ],
    }),
  );
  const saleBody = await response.json();
  assert.equal(response.status, 200);

  const printResponse = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "sale-lpg", documentNo: saleBody.issueNo }),
  });
  const body = await printResponse.json();

  assert.equal(printResponse.status, 200);
  assert.equal(body.document.invoiceLanguage, "Urdu");
  assert.equal(body.document.lineItems.length, 2);
  assert.equal(body.document.lineItems[0].exGstAmount, "6000");
  assert.equal(body.document.lineItems[0].gstAmount, "600");
  assert.equal(body.document.lineItems[0].securityDepositAmount, "500");
  assert.equal(body.document.lineItems[0].incGstAmount, "6600");
  assert.equal(body.document.totals.totalDebit, "14450");
});

test("cylinder return print payload includes all return lines and return type", async () => {
  const { company, financialYear, item, seedItem, customer, user } = await isolatedFixture(prisma, "DOC-RET");
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `DOC-RET-ITEM-${Date.now()}`,
      name: "Printable Return Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await prisma.customerCylinderBalance.createMany({
    data: [
      { customerId: customer.id, itemId: item.id, emptyOwed: 2 },
      { customerId: customer.id, itemId: secondItem.id, emptyOwed: 1 },
    ],
  });
  const response = await cylinderReturnRoute.POST(
    await authedJsonRequest(user, {
      customerId: customer.id,
      transactionDate: "2026-07-22",
      lines: [
        { itemId: item.id, returnType: "Empty", quantity: 1 },
        { itemId: secondItem.id, returnType: "Filled", quantity: 1, unitPrice: 2000, gstPercent: 5 },
      ],
    }),
  );
  const returnBody = await response.json();
  assert.equal(response.status, 200);

  const printResponse = await documentRoute.GET(await authedRequest(user), {
    params: Promise.resolve({ documentType: "cylinder-return", documentNo: returnBody.returnNo }),
  });
  const body = await printResponse.json();

  assert.equal(printResponse.status, 200);
  assert.equal(body.document.lineItems.length, 2);
  assert.equal(body.document.lineItems[0].returnType, "Empty");
  assert.equal(body.document.lineItems[1].returnType, "Filled");
  assert.equal(body.document.lineItems[1].totalAmount, "2100");
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
  assert.match(component, /LPG Management System/);
  assert.match(salePage, /documentType="sale-lpg"/);
  assert.match(securityPage, /documentType="security-receipt"/);
});
