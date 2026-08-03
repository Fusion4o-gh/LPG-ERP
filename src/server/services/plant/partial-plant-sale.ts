import { AuditAction, BulkStockSourceType, PartialPlantSaleType, PermissionAction, Prisma, StockDirection, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createBulkStockLedgerEntry } from "../inventory/bulk-stock-ledger.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Input = Record<string, unknown> & { saleType?: string; transactionDate?: string; allowClosedDayOverride?: boolean };

const required = (value: unknown, field: string) => {
  if (value === undefined || value === null || String(value).trim() === "") throw new Error(`${field} is required.`);
  return String(value).trim();
};
const decimal = (value: unknown, field: string, positive = false) => {
  const result = new Prisma.Decimal((value ?? 0) as any);
  if (!result.isFinite() || result.isNegative() || (positive && result.isZero())) throw new Error(`${field} must be ${positive ? "greater than zero" : "non-negative"}.`);
  return result;
};
const optionalDate = (value: unknown, field: string) => {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const result = new Date(String(value));
  if (Number.isNaN(result.valueOf())) throw new Error(`${field} is invalid.`);
  return result;
};
const transactionDate = (value: unknown) => {
  const result = new Date(required(value, "transactionDate"));
  if (Number.isNaN(result.valueOf())) throw new Error("transactionDate is invalid.");
  return result;
};
const type = (value?: string) => value === PartialPlantSaleType.DECANTING ? PartialPlantSaleType.DECANTING : PartialPlantSaleType.BULK;
const output = (row: any) => {
  const result = { ...row };
  for (const field of ["tankStock", "loadWeight", "decantingWeight", "contractRate", "orderAmount", "freightRate", "freightAmount", "weightDifference", "lossGainRate", "lossGainAmount", "commissionRate", "commissionAmount"]) result[field] = row[field].toString();
  result.transactionDate = row.transactionDate.toISOString().slice(0, 10);
  result.loadingDate = row.loadingDate?.toISOString().slice(0, 10) ?? null;
  result.orderDate = row.orderDate?.toISOString().slice(0, 10) ?? null;
  return result;
};

export async function listPartialPlantSales(context: Context) {
  const rows = await prisma.partialPlantSale.findMany({ where: { companyId: context.companyId }, orderBy: [{ transactionDate: "desc" }, { documentNo: "desc" }], take: 500 });
  const [plants, customers, products] = await Promise.all([
    prisma.plant.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.plantId) } }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.customerId) } }, select: { id: true, name: true } }),
    prisma.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.productId) } }, select: { id: true, name: true } }),
  ]);
  const names = (items: { id: string; name: string }[]) => new Map(items.map((item) => [item.id, item.name]));
  const plantNames = names(plants); const customerNames = names(customers); const productNames = names(products);
  return rows.map((row) => ({ ...output(row), plantName: plantNames.get(row.plantId) ?? row.plantId, customerName: customerNames.get(row.customerId) ?? row.customerId, productName: productNames.get(row.productId) ?? row.productId }));
}

async function references(tx: Prisma.TransactionClient, context: Context, input: Input) {
  const plantId = required(input.plantId, "plantId"); const locationId = required(input.locationId, "locationId"); const productId = required(input.productId, "productId"); const customerId = required(input.customerId, "customerId");
  const [plant, location, product, customer] = await Promise.all([
    tx.plant.findFirst({ where: { id: plantId, companyId: context.companyId }, select: { id: true } }),
    tx.stockLocation.findFirst({ where: { id: locationId, companyId: context.companyId, plantId }, select: { id: true } }),
    tx.bulkProduct.findFirst({ where: { id: productId, companyId: context.companyId }, select: { id: true } }),
    tx.customer.findFirst({ where: { id: customerId, companyId: context.companyId }, select: { id: true } }),
  ]);
  if (!plant) throw new Error("plantId is invalid."); if (!location) throw new Error("locationId is invalid or does not belong to plant."); if (!product) throw new Error("productId is invalid."); if (!customer) throw new Error("customerId is invalid.");
  return { plantId, locationId, productId, customerId };
}

export async function createPartialPlantSale(context: Context, input: Input) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "partial-plant-sale", PermissionAction.CREATE);
    const date = transactionDate(input.transactionDate); await assertWritableBusinessDate(tx, { ...context, transactionDate: date, allowClosedDayOverride: input.allowClosedDayOverride });
    const refs = await references(tx, context, input); const saleType = type(input.saleType);
    const documentNo = await nextDocumentNumberInTransaction(tx, { ...context, prefix: DOCUMENT_PREFIXES.partialPlantSale });
    const row = await tx.partialPlantSale.create({ data: { companyId: context.companyId, financialYearId: context.financialYearId, documentNo, saleType, ...refs, transporterId: typeof input.transporterId === "string" ? input.transporterId : null, vehicleNo: typeof input.vehicleNo === "string" ? input.vehicleNo.trim() : null, driverCell: typeof input.driverCell === "string" ? input.driverCell.trim() : null, loadingFrom: typeof input.loadingFrom === "string" ? input.loadingFrom.trim() : null, loadingDate: optionalDate(input.loadingDate, "loadingDate"), orderDate: optionalDate(input.orderDate, "orderDate"), tankStock: decimal(input.tankStock, "tankStock"), loadWeight: decimal(input.loadWeight, "loadWeight"), decantingWeight: decimal(input.decantingWeight, "decantingWeight", true), contractRate: decimal(input.contractRate, "contractRate"), orderAmount: decimal(input.orderAmount, "orderAmount"), freightRate: decimal(input.freightRate, "freightRate"), freightAmount: decimal(input.freightAmount, "freightAmount"), weightDifference: decimal(input.weightDifference, "weightDifference"), lossGainRate: decimal(input.lossGainRate, "lossGainRate"), lossGainAmount: decimal(input.lossGainAmount, "lossGainAmount"), remarks: typeof input.remarks === "string" ? input.remarks.trim() : null, commissionStatus: typeof input.commissionStatus === "string" ? input.commissionStatus.trim() : null, commissionName: typeof input.commissionName === "string" ? input.commissionName.trim() : null, commissionRate: decimal(input.commissionRate, "commissionRate"), commissionAmount: decimal(input.commissionAmount, "commissionAmount"), transactionDate: date, createdById: context.userId } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "PartialPlantSale", entityId: row.id, after: row });
    return output(row);
  });
}

export async function approvePartialPlantSale(context: Context, id: string, approved: boolean) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "partial-plant-sale", PermissionAction.UPDATE);
    const before = await tx.partialPlantSale.findFirst({ where: { id, companyId: context.companyId } }); if (!before) throw new Error("Partial plant sale not found."); if (before.postedToLedger) throw new Error("Posted partial plant sale cannot be changed.");
    const row = await tx.partialPlantSale.update({ where: { id }, data: { saleStatus: approved ? "APPROVED" : "DISAPPROVED", approvedById: context.userId } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "PartialPlantSale", entityId: id, before, after: row }); return output(row);
  });
}

export async function closePartialPlantSale(context: Context, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "partial-plant-sale", PermissionAction.UPDATE);
    const before = await tx.partialPlantSale.findFirst({ where: { id, companyId: context.companyId } }); if (!before) throw new Error("Partial plant sale not found."); if (before.saleStatus !== "APPROVED") throw new Error("Partial plant sale must be approved before closing."); if (before.postedToLedger) throw new Error("Partial plant sale is already posted.");
    await assertWritableBusinessDate(tx, { ...context, transactionDate: before.transactionDate });
    const amount = before.orderAmount.isZero() ? before.decantingWeight.mul(before.contractRate) : before.orderAmount; if (amount.isNegative() || amount.isZero()) throw new Error("orderAmount must be greater than zero before closing.");
    const row = await tx.partialPlantSale.update({ where: { id }, data: { finalStatus: "CLOSE" } }); await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "PartialPlantSale", entityId: id, before, after: row }); return output(row);
  });
}

export async function postPartialPlantSaleToPl(context: Context, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "partial-plant-sale", PermissionAction.UPDATE);
    const before = await tx.partialPlantSale.findFirst({ where: { id, companyId: context.companyId } }); if (!before) throw new Error("Partial plant sale not found."); if (before.saleStatus !== "APPROVED" || before.finalStatus !== "CLOSE") throw new Error("Partial plant sale must be approved and closed before posting to P&L."); if (before.postedToLedger) throw new Error("Partial plant sale is already posted.");
    await assertWritableBusinessDate(tx, { ...context, transactionDate: before.transactionDate });
    const quantity = before.decantingWeight; const amount = before.orderAmount.isZero() ? quantity.mul(before.contractRate) : before.orderAmount;
    await createBulkStockLedgerEntry(tx, { companyId: context.companyId, financialYearId: context.financialYearId, productId: before.productId, locationId: before.locationId, plantId: before.plantId, direction: StockDirection.OUT, quantity, unit: "MT", sourceType: BulkStockSourceType.PARTIAL_SALE, sourceId: before.id, transactionDate: before.transactionDate, createdById: context.userId, customerId: before.customerId, remarks: `Partial ${before.saleType} sale ${before.documentNo}` });
    const customer = await tx.customer.findFirstOrThrow({ where: { id: before.customerId, companyId: context.companyId }, select: { accountId: true } }); const salesAccountId = await getAccountIdByCode(tx, context.companyId, ACCOUNT_CODES.bulkSales);
    const voucher = await createBalancedVoucher(tx, { companyId: context.companyId, financialYearId: context.financialYearId, voucherNo: before.documentNo, voucherType: VoucherType.JV, voucherDate: before.transactionDate, narration: before.remarks ?? undefined, sourceType: "PartialPlantSale", sourceId: before.id, createdById: context.userId, lines: [{ accountId: customer.accountId, debit: amount }, { accountId: salesAccountId, credit: amount }] });
    const row = await tx.partialPlantSale.update({ where: { id }, data: { finalStatus: "CLOSE", postedToLedger: true, voucherId: voucher.id } }); await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "PartialPlantSale", entityId: id, before, after: row }); return { ...output(row), voucherId: voucher.id, voucherNo: voucher.voucherNo };
  });
}
