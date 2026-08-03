import { ApprovalStatus, AuditAction, BulkStockSourceType, LossGainType, PermissionAction, Prisma, StockDirection, UnitOfMeasure, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createBulkStockLedgerEntry, getBulkOnHand } from "../inventory/bulk-stock-ledger.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Input = { type?: string; productId?: string; locationId?: string; quantity?: string | number; rate?: string | number; transactionDate?: string; remarks?: string; allowClosedDayOverride?: boolean };

const required = (value: unknown, field: string) => { if (value === undefined || value === null || String(value).trim() === "") throw new Error(`${field} is required.`); return String(value).trim(); };
const decimal = (value: unknown, field: string, positive = false) => { const result = new Prisma.Decimal((value ?? 0) as string | number | Prisma.Decimal); if (!result.isFinite() || result.isNegative() || (positive && result.isZero())) throw new Error(`${field} must be ${positive ? "greater than zero" : "non-negative"}.`); return result; };
const date = (value: unknown) => { const result = new Date(required(value, "transactionDate")); if (Number.isNaN(result.valueOf())) throw new Error("transactionDate is invalid."); return result; };
const output = (row: any) => ({ ...row, expectedQuantity: row.expectedQuantity.toString(), actualQuantity: row.actualQuantity.toString(), difference: row.difference.toString(), rate: row.rate.toString(), financialImpact: row.financialImpact.toString(), transactionDate: row.transactionDate.toISOString().slice(0, 10) });

async function refs(tx: Prisma.TransactionClient, context: Context, productId: string, locationId: string) {
  const [product, location] = await Promise.all([
    tx.bulkProduct.findFirst({ where: { id: productId, companyId: context.companyId }, select: { id: true, name: true } }),
    tx.stockLocation.findFirst({ where: { id: locationId, companyId: context.companyId }, select: { id: true, plantId: true, name: true } }),
  ]);
  if (!product) throw new Error("productId is invalid.");
  if (!location) throw new Error("locationId is invalid.");
  return { product, location };
}

export async function listLossGains(context: Context, filters: { from?: string; to?: string; status?: string } = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "loss-gain", PermissionAction.VIEW);
    const rows = await tx.lossGain.findMany({ where: { companyId: context.companyId, ...(filters.status ? { status: filters.status as ApprovalStatus } : {}), transactionDate: { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined } }, orderBy: [{ transactionDate: "desc" }, { documentNo: "desc" }], take: 500 });
    const [products, locations] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.productId) } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.locationId) } }, select: { id: true, code: true, name: true } }),
    ]);
    const pm = new Map(products.map((row) => [row.id, row])); const lm = new Map(locations.map((row) => [row.id, row]));
    return rows.map((row) => ({ ...output(row), product: pm.get(row.productId), location: lm.get(row.locationId) }));
  });
}

export async function createLossGain(context: Context, input: Input) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "loss-gain", PermissionAction.CREATE);
    const type = input.type === LossGainType.GAIN ? LossGainType.GAIN : input.type === LossGainType.LOSS ? LossGainType.LOSS : (() => { throw new Error("type must be LOSS or GAIN."); })();
    const productId = required(input.productId, "productId"); const locationId = required(input.locationId, "locationId");
    const quantity = decimal(input.quantity, "quantity", true); const rate = decimal(input.rate, "rate"); const transactionDate = date(input.transactionDate);
    const { location } = await refs(tx, context, productId, locationId);
    await assertWritableBusinessDate(tx, { ...context, transactionDate, allowClosedDayOverride: input.allowClosedDayOverride });
    const current = await getBulkOnHand(tx, context.companyId, productId, locationId);
    const difference = type === LossGainType.LOSS ? quantity.negated() : quantity;
    const amount = quantity.times(rate);
    const documentNo = await nextDocumentNumberInTransaction(tx, { ...context, prefix: DOCUMENT_PREFIXES.lossGain });
    const row = await tx.lossGain.create({ data: { companyId: context.companyId, financialYearId: context.financialYearId, documentNo, type, productId, locationId, expectedQuantity: current, actualQuantity: current.plus(difference), difference, rate, financialImpact: type === LossGainType.LOSS ? amount.negated() : amount, reason: input.remarks?.trim() || null, transactionDate, createdById: context.userId } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "LossGain", entityId: row.id, after: row });
    return output(row);
  });
}

export async function approveLossGain(context: Context, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "loss-gain", PermissionAction.APPROVE);
    const before = await tx.lossGain.findFirstOrThrow({ where: { id, companyId: context.companyId, financialYearId: context.financialYearId } });
    if (before.status !== ApprovalStatus.PENDING) throw new Error("Only pending loss/gain adjustments can be approved.");
    const row = await tx.lossGain.update({ where: { id }, data: { status: ApprovalStatus.APPROVED, approvedById: context.userId } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "LossGain", entityId: id, before, after: row });
    return output(row);
  });
}

export async function postLossGainToPl(context: Context, id: string, allowClosedDayOverride = false) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "loss-gain", PermissionAction.APPROVE);
    const before = await tx.lossGain.findFirstOrThrow({ where: { id, companyId: context.companyId, financialYearId: context.financialYearId } });
    if (before.status !== ApprovalStatus.APPROVED) throw new Error("Loss/gain adjustment must be approved before posting to P&L.");
    if (before.postedToPl) throw new Error("Loss/gain adjustment is already posted to P&L.");
    await assertWritableBusinessDate(tx, { ...context, transactionDate: before.transactionDate, allowClosedDayOverride });
    const direction = before.type === LossGainType.LOSS ? StockDirection.OUT : StockDirection.IN;
    const stockEntry = await createBulkStockLedgerEntry(tx, { companyId: context.companyId, financialYearId: context.financialYearId, productId: before.productId, locationId: before.locationId, direction, quantity: before.difference.abs(), unit: UnitOfMeasure.MT, sourceType: BulkStockSourceType.LOSS_GAIN, sourceId: before.id, transactionDate: before.transactionDate, createdById: context.userId, allowNegative: true, remarks: `Loss/gain ${before.documentNo}` });
    const stockAccountId = await getAccountIdByCode(tx, context.companyId, ACCOUNT_CODES.bulkStock);
    const resultAccountId = await getAccountIdByCode(tx, context.companyId, before.type === LossGainType.LOSS ? ACCOUNT_CODES.inventoryLoss : ACCOUNT_CODES.inventoryGain);
    const lines = before.type === LossGainType.LOSS ? [{ accountId: resultAccountId, debit: before.financialImpact.abs() }, { accountId: stockAccountId, credit: before.financialImpact.abs() }] : [{ accountId: stockAccountId, debit: before.financialImpact }, { accountId: resultAccountId, credit: before.financialImpact }];
    const voucher = await createBalancedVoucher(tx, { companyId: context.companyId, financialYearId: context.financialYearId, voucherNo: before.documentNo, voucherType: VoucherType.JV, voucherDate: before.transactionDate, narration: before.reason ?? `Loss/gain ${before.documentNo}`, sourceType: "LossGain", sourceId: before.id, createdById: context.userId, lines });
    const row = await tx.lossGain.update({ where: { id }, data: { postedToPl: true, voucherId: voucher.id } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "LossGain", entityId: id, before, after: { ...row, stockEntryId: stockEntry.id, voucherId: voucher.id } });
    return { ...output(row), voucherNo: voucher.voucherNo, stockEntryId: stockEntry.id };
  });
}
