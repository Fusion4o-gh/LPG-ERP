import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function file(path) {
  return readFile(new URL(path, root), "utf8");
}

async function exists(path) {
  const ok = await stat(new URL(path, root)).then(() => true, () => false);
  assert.equal(ok, true, `${path} should exist`);
}

test("bank payments receipts page exists and uses unified client component", async () => {
  const page = await file("src/app/(protected)/payments/bank-payments-receipts/page.tsx");
  assert.doesNotMatch(page, /ComingSoonPage/, "page must not use ComingSoonPage");
  assert.match(page, /BankPaymentsReceiptsClient/, "page must use BankPaymentsReceiptsClient");
});

test("BankPaymentsReceiptsClient component exists", async () => {
  await exists("src/components/BankPaymentsReceiptsClient.tsx");
});

test("unified screen renders Bank Payments / Receipt title", async () => {
  const client = await file("src/components/BankPaymentsReceiptsClient.tsx");
  assert.match(client, /Bank Payments \/ Receipt/);
});

test("unified screen has action links to Bank Receipt and Bank Payment routes", async () => {
  const client = await file("src/components/BankPaymentsReceiptsClient.tsx");
  assert.match(client, /\/payments\/bank-receipt/, "must link to bank receipt route");
  assert.match(client, /\/payments\/bank-payment/, "must link to bank payment route");
  assert.match(client, /Bank Receipt/);
  assert.match(client, /Bank Payment/);
});

test("unified screen loads recent bank vouchers from voucher API", async () => {
  const client = await file("src/components/BankPaymentsReceiptsClient.tsx");
  assert.match(client, /\/api\/accounting\/vouchers/, "must call voucher API");
  assert.match(client, /BankReceipt/, "must filter BankReceipt sourceType");
  assert.match(client, /BankPayment/, "must filter BankPayment sourceType");
});

test("unified screen supports date and type filters for bank vouchers", async () => {
  const client = await file("src/components/BankPaymentsReceiptsClient.tsx");
  assert.match(client, /typeFilter/, "must have type filter state");
  assert.match(client, /fromDate/, "must have from-date filter state");
  assert.match(client, /toDate/, "must have to-date filter state");
});

test("separate bank receipt and bank payment pages still exist and are functional", async () => {
  const receipt = await file("src/app/(protected)/payments/bank-receipt/page.tsx");
  const payment = await file("src/app/(protected)/payments/bank-payment/page.tsx");

  assert.match(receipt, /OperationForm/, "bank-receipt page must use OperationForm");
  assert.match(payment, /OperationForm/, "bank-payment page must use OperationForm");
  assert.match(receipt, /bank-receipt/, "bank-receipt page must reference its endpoint");
  assert.match(payment, /bank-payment/, "bank-payment page must reference its endpoint");
});

test("unified screen uses Fusion4o blue/white styling patterns", async () => {
  const client = await file("src/components/BankPaymentsReceiptsClient.tsx");
  assert.match(client, /border-blue-100|bg-blue-50|text-blue-700/, "must use Fusion4o blue styling");
  assert.match(client, /bg-white/, "must use white card backgrounds");
  assert.match(client, /rounded-xl|rounded-lg|rounded-md/, "must use rounded card styling");
  assert.match(client, /shadow-sm/, "must use card shadow");
});

test("sidebar Bank Payments / Receipt link requires bank-payments module permission", async () => {
  const sidebar = await file("src/components/Sidebar.tsx");
  assert.match(
    sidebar,
    /bank-payments-receipts[\s\S]{0,100}bank-payments|bank-payments[\s\S]{0,100}bank-payments-receipts/,
    "sidebar must gate bank-payments-receipts behind bank-payments module"
  );
});

test("protected layout enforces session authentication for all bank payment routes", async () => {
  const layout = await file("src/app/(protected)/layout.tsx");
  assert.match(layout, /getSessionContextFromCookies/, "layout must check session");
  assert.match(layout, /redirect.*login|login.*redirect/, "layout must redirect unauthenticated users");
});
