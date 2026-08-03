import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { isolatedFixture } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const stockAvailabilityRoute = await import("../src/app/api/stock-availability/route.ts");
const securityReceiptRoute = await import("../src/app/api/payments/security-receipt/route.ts");
const transactionDocumentRoute = await import("../src/app/api/transaction-documents/[documentType]/[documentNo]/route.ts");

test.after(async () => {
  await prisma.$disconnect();
});

test("stock availability returns filled stock for the selected item", async () => {
  const { company, financialYear, user, item } = await isolatedFixture(prisma, "SEC-STOCK");
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "FILLED",
      direction: "IN",
      sourceType: "OPENING_BALANCE",
      sourceId: `SEC-OPEN-${Date.now()}`,
      transactionDate: new Date("2026-08-02"),
      quantity: 7,
      balanceAfter: 7,
      createdById: user.id,
    },
  });

  const session = await sessions.createSession(user.id);
  const response = await stockAvailabilityRoute.GET(
    new Request(`http://localhost/api/stock-availability?itemId=${encodeURIComponent(item.id)}`, {
      headers: { cookie: `lpg_erp_session=${session.sessionToken}` },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.itemId, item.id);
  assert.equal(body.available, 7);
});

test("stock availability returns the selected cylinder state and rejects unknown states", async () => {
  const { company, financialYear, user, item } = await isolatedFixture(prisma, "SEC-EMPTY-STOCK");
  await prisma.stockLedgerEntry.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      itemId: item.id,
      cylinderState: "EMPTY",
      direction: "IN",
      sourceType: "ADJUSTMENT",
      sourceId: `EMPTY-STOCK-${Date.now()}`,
      transactionDate: new Date("2026-07-22"),
      quantity: 4,
      balanceAfter: 4,
      createdById: user.id,
    },
  });
  const session = await sessions.createSession(user.id);
  const response = await stockAvailabilityRoute.GET(
    new Request(`http://localhost/api/stock-availability?itemId=${encodeURIComponent(item.id)}&cylinderState=EMPTY`, {
      headers: { cookie: `lpg_erp_session=${session.sessionToken}` },
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.cylinderState, "EMPTY");
  assert.equal(body.available, 4);

  const invalid = await stockAvailabilityRoute.GET(
    new Request(`http://localhost/api/stock-availability?itemId=${encodeURIComponent(item.id)}&cylinderState=OTHER`, {
      headers: { cookie: `lpg_erp_session=${session.sessionToken}` },
    }),
  );
  assert.equal(invalid.status, 400);
});

test("stock availability requires stock-ledger view permission", async () => {
  const { company, financialYear, user, item } = await isolatedFixture(prisma, "SEC-DENY");
  const denied = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: "Security Receipt Denied",
      loginId: `sec-deny-${Date.now()}`,
      passwordHash: "test",
    },
  });
  const role = await prisma.role.create({ data: { companyId: company.id, name: `sec-deny-role-${Date.now()}` } });
  await prisma.userRole.create({ data: { userId: denied.id, roleId: role.id } });
  const permission = await prisma.permission.findUniqueOrThrow({
    where: { module_action: { module: "stock-ledger", action: PermissionAction.VIEW } },
  });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: permission.id } });

  const session = await sessions.createSession(denied.id);
  const response = await stockAvailabilityRoute.GET(
    new Request(`http://localhost/api/stock-availability?itemId=${encodeURIComponent(item.id)}`, {
      headers: { cookie: `lpg_erp_session=${session.sessionToken}` },
    }),
  );

  assert.equal(response.status, 403);
});

test("security receipt preserves remarks and cheque date through audit and print payload", async () => {
  const { customer, item, user } = await isolatedFixture(prisma, "SEC-META");
  const session = await sessions.createSession(user.id);
  const response = await securityReceiptRoute.POST(
    new Request("http://localhost/api/payments/security-receipt", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
      body: JSON.stringify({
        customerId: customer.id,
        itemId: item.id,
        quantity: 2,
        amount: 500,
        transactionDate: "2026-08-02",
        receiveMode: "Cash",
        chequeDate: "2026-08-01",
        chequeNo: "SR-CHQ-1",
        remarks: "Reference metadata",
      }),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200);

  const printResponse = await transactionDocumentRoute.GET(
    new Request(`http://localhost/api/transaction-documents/security-receipt/${encodeURIComponent(body.receiptNo)}`, {
      headers: { cookie: `lpg_erp_session=${session.sessionToken}` },
    }),
    { params: Promise.resolve({ documentType: "security-receipt", documentNo: body.receiptNo }) },
  );
  const printBody = await printResponse.json();
  assert.equal(printResponse.status, 200);
  assert.equal(printBody.document.chequeDate, "2026-08-01");
  assert.equal(printBody.document.chequeNo, "SR-CHQ-1");
  assert.equal(printBody.document.remarks, "Reference metadata");
});
