import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const service = await import("../src/server/services/plant/loss-gain.ts");

test.after(async () => prisma.$disconnect());

test("loss/gain adjustment approves and posts stock and balanced P&L voucher", async () => {
  const base = await baseFixture(prisma);
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("LG-P"), name: "Loss Gain Product" } });
  const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("LG-PL"), name: "Loss Gain Plant" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("LG-L"), name: "Loss Gain Tank", type: "PLANT" } });
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };

  const created = await service.createLossGain(context, { type: "LOSS", productId: product.id, locationId: location.id, quantity: 2, rate: 500, transactionDate: "2026-08-02", remarks: "Evaporation" });
  assert.equal(created.type, "LOSS");
  assert.equal(created.difference, "-2");
  assert.equal(created.financialImpact, "-1000");

  const approved = await service.approveLossGain(context, created.id);
  assert.equal(approved.status, "APPROVED");
  const posted = await service.postLossGainToPl(context, created.id);
  assert.equal(posted.postedToPl, true);
  assert.match(posted.voucherNo, /^LG-/);
  assert.equal(await prisma.bulkStockLedgerEntry.count({ where: { sourceId: created.id, sourceType: "LOSS_GAIN" } }), 1);
  const voucher = await prisma.accountingVoucher.findUniqueOrThrow({ where: { id: posted.voucherId }, include: { lines: true } });
  assert.equal(Number(voucher.totalDebit), 1000);
  assert.equal(Number(voucher.totalCredit), 1000);
});

test("loss/gain posting requires approval and cannot be posted twice", async () => {
  const base = await baseFixture(prisma);
  const product = await prisma.bulkProduct.create({ data: { companyId: base.company.id, code: doc("LG-P2"), name: "Loss Gain Product 2" } });
  const plant = await prisma.plant.create({ data: { companyId: base.company.id, code: doc("LG-PL2"), name: "Loss Gain Plant 2" } });
  const location = await prisma.stockLocation.create({ data: { companyId: base.company.id, plantId: plant.id, code: doc("LG-L2"), name: "Loss Gain Tank 2", type: "PLANT" } });
  const context = { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id };
  const created = await service.createLossGain(context, { type: "GAIN", productId: product.id, locationId: location.id, quantity: 1, rate: 100, transactionDate: "2026-08-02" });
  await assert.rejects(service.postLossGainToPl(context, created.id), /approved/i);
  await service.approveLossGain(context, created.id);
  await service.postLossGainToPl(context, created.id);
  await assert.rejects(service.postLossGainToPl(context, created.id), /already posted/i);
});
