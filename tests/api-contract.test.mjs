import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");

const purchaseRoute = await import("../src/app/api/purchases/filled-cylinder/route.ts");
const saleRoute = await import("../src/app/api/sales/lpg/route.ts");
const batchSaleRoute = await import("../src/app/api/sales/lpg/batch/route.ts");
const cylinderReturnRoute = await import("../src/app/api/returns/cylinder/route.ts");
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

test("purchase API accepts legacy multi-line GIRN payload and returns one receipt number", async () => {
  const { company, financialYear, user, item, seedItem, vendor } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `API-MULTI-${Date.now()}`,
      name: "API Multi Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "EMPTY",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: `API-OPEN-EMPTY-${Date.now()}`,
      transactionDate: new Date("2026-07-20"),
      quantity: 3,
      balanceAfter: 3,
      createdById: user.id,
    },
  });
  const session = await sessions.createSession(user.id);
  const response = await purchaseRoute.POST(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
      body: JSON.stringify({
        vendorId: vendor.id,
        transactionDate: "2026-07-21",
        remarks: "API multi-line purchase",
        elevenPointEightKgPrice: 2400,
        lines: [
          { itemId: item.id, cylinderState: "FILLED", quantity: 2, unitCost: 2200, gstPercent: 10, emptyReturnQuantity: 1 },
          { itemId: secondItem.id, cylinderState: "FILLED", quantity: 1, unitCost: 1800, gstPercent: 5 },
        ],
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.issueNo, /^PR-/);
  assert.equal(body.ids.stockEntryIds.length, 3);

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: body.ids.voucherId } });
  assert.equal(voucher.voucherNo, body.issueNo);
  assert.equal(Number(voucher.totalDebit), 6730);
});

test("sale API accepts legacy multi-line LPG invoice payload and returns one issue number", async () => {
  const { company, financialYear, user, item, seedItem, vendor, customer } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `API-SALE-MULTI-${Date.now()}`,
      name: "API Sale Multi Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await prisma.stockLedgerEntry.createMany({
    data: [
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: item.id,
        cylinderState: "FILLED",
        direction: "IN",
        sourceType: "OPENING_BALANCE",
        sourceId: `API-SALE-OPEN-${Date.now()}-1`,
        transactionDate: new Date("2026-07-20"),
        quantity: 4,
        balanceAfter: 4,
        createdById: user.id,
      },
      {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: secondItem.id,
        cylinderState: "FILLED",
        direction: "IN",
        sourceType: "OPENING_BALANCE",
        sourceId: `API-SALE-OPEN-${Date.now()}-2`,
        transactionDate: new Date("2026-07-20"),
        quantity: 2,
        balanceAfter: 2,
        createdById: user.id,
      },
    ],
  });
  const session = await sessions.createSession(user.id);
  const response = await saleRoute.POST(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
      body: JSON.stringify({
        customerId: customer.id,
        transactionDate: "2026-07-21",
        saleType: "Direct",
        remarks: "API multi-line sale",
        elevenPointEightKgPrice: 3300,
        invoiceLanguage: "English",
        lines: [
          { itemId: item.id, quantity: 2, unitPrice: 3000, gstPercent: 10, securityDepositAmount: 500, emptyReturnItemId: item.id, emptyReturnQuantity: 1 },
          { itemId: secondItem.id, quantity: 1, unitPrice: 2000, gstPercent: 5, securityDepositAmount: 250 },
        ],
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.issueNo, /^SI-/);
  assert.equal(body.ids.stockEntryIds.length, 3);

  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: body.ids.voucherId } });
  assert.equal(voucher.voucherNo, body.issueNo);
  assert.equal(Number(voucher.totalDebit), 9450);
});

test("complete day sale API accepts legacy batch rows with up to three item slots and cash receipt amount", async () => {
  const { company, financialYear, user, item, seedItem, vendor, customer } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `API-DAY-ITEM-2-${Date.now()}`,
      name: "API Day Item 2",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  const thirdItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `API-DAY-ITEM-3-${Date.now()}`,
      name: "API Day Item 3",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await prisma.stockLedgerEntry.createMany({
    data: [item.id, secondItem.id, thirdItem.id].map((itemId, index) => ({
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId,
      cylinderState: "FILLED",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: `API-DAY-OPEN-${Date.now()}-${index}`,
      transactionDate: new Date("2026-07-20"),
      quantity: 5,
      balanceAfter: 5,
      createdById: user.id,
    })),
  });
  const session = await sessions.createSession(user.id);
  const response = await batchSaleRoute.POST(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
      body: JSON.stringify({
        transactionDate: "2026-07-21",
        remarks: "API complete day",
        rows: [
          {
            customerId: customer.id,
            elevenPointEightKgPrice: 3300,
            paymentType: "Cash",
            amountReceived: 4000,
            items: [
              { itemId: item.id, quantity: 1, unitPrice: 3000 },
              { itemId: secondItem.id, quantity: 1, unitPrice: 2000 },
              { itemId: thirdItem.id, quantity: 1, unitPrice: 1000 },
            ],
          },
        ],
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.batchNo, /^BSI-/);
  assert.equal(body.issueNos.length, 1);
  assert.equal(body.ids.voucherIds.length, 1);
  assert.equal(body.ids.receiptVoucherIds.length, 1);
});

test("cylinder return API accepts legacy multi-line empty and filled return payload", async () => {
  const { company, financialYear, user, item, seedItem, vendor, customer } = await fixture();
  const secondItem = await prisma.item.create({
    data: {
      companyId: company.id,
      code: `API-RET-ITEM-${Date.now()}`,
      name: "API Return Cylinder",
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
  await prisma.stockLedgerEntry.createMany({
    data: [item.id, secondItem.id].map((itemId, index) => ({
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId,
      cylinderState: "FILLED",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: `API-RET-OPEN-${Date.now()}-${index}`,
      transactionDate: new Date("2026-07-20"),
      quantity: 3,
      balanceAfter: 3,
      createdById: user.id,
    })),
  });
  await prisma.customerCylinderBalance.createMany({
    data: [
      { customerId: customer.id, itemId: item.id, emptyOwed: 2 },
      { customerId: customer.id, itemId: secondItem.id, emptyOwed: 1 },
    ],
  });
  const session = await sessions.createSession(user.id);
  const response = await cylinderReturnRoute.POST(
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
      body: JSON.stringify({
        customerId: customer.id,
        transactionDate: "2026-07-21",
        remarks: "API legacy return",
        lines: [
          { itemId: item.id, returnType: "Empty", quantity: 1 },
          { itemId: secondItem.id, returnType: "Filled", quantity: 1, unitPrice: 2000, gstPercent: 5 },
        ],
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.returnNo, /^RTN-/);
  assert.equal(body.ids.stockEntryIds.length, 2);
  assert.ok(body.ids.voucherId);
});

test("context API exposes the current company from centralized request context", async () => {
  const response = await currentCompanyRoute.GET(await authedGetRequest("http://localhost/api/context/current-company"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.company.id);
});
