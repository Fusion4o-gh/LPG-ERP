import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc, createIsolatedItem } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const returns = await import("../src/server/services/returns/cylinder-return.ts");
test.after(async () => prisma.$disconnect());

test("valued cylinder return remains pending until approval, then posts once", async () => {
  const base = await baseFixture(prisma); const item = await createIsolatedItem(prisma, base.company.id, base.seedItem, "APP-RET"); const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id }; const returnNo = doc("APP-RTN");
  const pending = await returns.requestValuedCylinderReturn({ ...context, returnNo, customerId: base.seedCustomer.id, transactionDate: "2027-02-10", lines: [{ itemId: item.id, returnType: "Filled", quantity: 1, unitPrice: 2000 }] });
  assert.equal(pending.status, "PENDING"); assert.equal(await prisma.stockLedgerEntry.count({ where: { sourceId: returnNo } }), 0);
  const listed = await returns.listValuedCylinderReturnApprovals(context); assert.ok(listed.some((row) => row.returnNo === returnNo));
  const approved = await returns.approveValuedCylinderReturn(context, pending.approvalId); assert.equal(approved.status, "APPROVED"); assert.equal(approved.stockEntries.length, 1); assert.equal(await prisma.stockLedgerEntry.count({ where: { sourceId: returnNo } }), 1); assert.equal(await prisma.accountingVoucher.count({ where: { sourceId: returnNo } }), 1);
  await assert.rejects(returns.approveValuedCylinderReturn(context, pending.approvalId), /Only pending/);
});
