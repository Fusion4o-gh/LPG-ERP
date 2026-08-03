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
  assert.equal(body.document.heading, body.document.legalName);
  assert.equal(body.document.companyAddress, null);
  assert.equal(body.document.logoUrl, null);
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
        { itemId: item.id, quantity: 2, unitPrice: 3000, securityDepositAmount: 500 },
        { itemId: secondItem.id, quantity: 1, unitPrice: 2000, securityDepositAmount: 250 },
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
  assert.equal(body.document.lineItems[0].amount, "6000");
  assert.equal(body.document.lineItems[0].securityDepositAmount, "500");
  assert.equal(body.document.totals.totalDebit, "13750");
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
        { itemId: secondItem.id, returnType: "Filled", quantity: 1, unitPrice: 2000 },
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

test("bulk-backed voucher documents expose printable lines", async () => {
  const { company, financialYear, user } = await isolatedFixture(prisma, "DOC-BULK-PRINT");
  const account = await prisma.chartAccount.findFirstOrThrow({ where: { companyId: company.id, accountType: "ASSET", parentId: { not: null }, status: "ACTIVE" } });
  const voucher = await prisma.accountingVoucher.create({ data: { companyId: company.id, financialYearId: financialYear.id, voucherNo: `OPV-TEST-${Date.now()}`, voucherType: "JV", voucherDate: new Date("2099-01-01"), sourceType: "OpeningVoucher", sourceId: `OPV-TEST-${Date.now()}`, createdById: user.id, totalDebit: 100, totalCredit: 100, lines: { create: [{ accountId: account.id, debit: 100, credit: 0, sortOrder: 1 }, { accountId: account.id, debit: 0, credit: 100, sortOrder: 2 }] } } });
  const response = await documentRoute.GET(await authedRequest(user), { params: Promise.resolve({ documentType: "opening-voucher", documentNo: voucher.voucherNo }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.document.type, "Opening Voucher");
  assert.equal(body.document.voucherLines.length, 2);
  const wrongTypeResponse = await documentRoute.GET(await authedRequest(user), { params: Promise.resolve({ documentType: "dollar-transaction", documentNo: voucher.voucherNo }) });
  assert.notEqual(wrongTypeResponse.status, 200);
});

test("plant transfer print payload resolves non-voucher bulk ledger lines", async () => {
  const { company, financialYear, user } = await isolatedFixture(prisma, "DOC-TRANSFER-PRINT");
  const [fromPlant, toPlant] = await Promise.all([
    prisma.plant.create({ data: { companyId: company.id, code: `PT-F-${Date.now()}`, name: "Print From Plant" } }),
    prisma.plant.create({ data: { companyId: company.id, code: `PT-T-${Date.now()}`, name: "Print To Plant" } }),
  ]);
  const [fromLocation, toLocation] = await Promise.all([
    prisma.stockLocation.create({ data: { companyId: company.id, plantId: fromPlant.id, code: `PT-FL-${Date.now()}`, name: "Print From Tank", type: "PLANT" } }),
    prisma.stockLocation.create({ data: { companyId: company.id, plantId: toPlant.id, code: `PT-TL-${Date.now()}`, name: "Print To Tank", type: "PLANT" } }),
  ]);
  const product = await prisma.bulkProduct.create({ data: { companyId: company.id, code: `PT-P-${Date.now()}`, name: "Printable Bulk LPG" } });
  const documentNo = `PT-PRINT-${Date.now()}`;
  const transfer = await prisma.plantTransfer.create({ data: { companyId: company.id, financialYearId: financialYear.id, documentNo, fromPlantId: fromPlant.id, toPlantId: toPlant.id, fromLocationId: fromLocation.id, toLocationId: toLocation.id, productId: product.id, quantity: 5, unit: "MT", transactionDate: new Date("2099-01-01"), createdById: user.id } });
  await prisma.bulkStockLedgerEntry.createMany({ data: [
    { companyId: company.id, financialYearId: financialYear.id, productId: product.id, locationId: fromLocation.id, plantId: fromPlant.id, direction: "OUT", quantity: 5, unit: "MT", balanceAfter: 0, sourceType: "PLANT_TRANSFER", sourceId: transfer.id, transactionDate: new Date("2099-01-01"), createdById: user.id },
    { companyId: company.id, financialYearId: financialYear.id, productId: product.id, locationId: toLocation.id, plantId: toPlant.id, direction: "IN", quantity: 5, unit: "MT", balanceAfter: 5, sourceType: "PLANT_TRANSFER", sourceId: transfer.id, transactionDate: new Date("2099-01-01"), createdById: user.id },
  ] });
  const response = await documentRoute.GET(await authedRequest(user), { params: Promise.resolve({ documentType: "plant-transfer", documentNo }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.document.type, "Plant Transfer");
  assert.equal(body.document.lineItems.length, 2);
  assert.equal(body.document.totals.quantity, 5);
});

test("printable transaction pages and component render document number and type metadata", async () => {
  const component = await file("src/components/PrintableTransactionDocument.tsx");
  const salePage = await file("src/app/(protected)/operations/sale-lpg/print/[documentNo]/page.tsx");
  const securityPage = await file("src/app/(protected)/payments/security-receipt/print/[documentNo]/page.tsx");

  assert.match(component, /Document Number/);
  assert.match(component, /document\.type/);
  assert.match(component, /document\.generatedAt/);
  assert.match(component, /document\.logoUrl/);
  assert.match(component, /document\.companyAddress/);
  assert.match(component, /document\.taxRegistrationNumber/);
  assert.match(component, /window\.print\(\)/);
  assert.match(component, /Print Language/);
  assert.match(component, /value="Urdu"/);
  assert.match(component, /data-print-hidden/);
  assert.match(component, /LPG Management System/);
  assert.match(salePage, /documentType="sale-lpg"/);
  assert.match(securityPage, /documentType="security-receipt"/);
  const genericPrintPage = await file("src/app/(protected)/documents/print/[documentType]/[documentNo]/page.tsx");
  assert.match(genericPrintPage, /PrintableTransactionDocument/);
  const loadingManager = await file("src/components/LoadingManager.tsx");
  assert.match(loadingManager, /documents\/print\/loading/);
});
