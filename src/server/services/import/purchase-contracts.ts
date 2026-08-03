import { AuditAction, ContractStatus, PermissionAction, Prisma, UnitOfMeasure } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { assertVendorAreaAccess } from "../user-management/area-access.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Input = { contractNo?: string; contractDate?: string; vendorId?: string; productId?: string; quantity?: string | number; unit?: string; rate?: string | number; amountPkr?: string | number; remarks?: string; status?: string; allowClosedDayOverride?: boolean };
const required = (value: unknown, field: string) => { if (value === undefined || value === null || String(value).trim() === "") throw new Error(`${field} is required.`); return String(value).trim(); };
const date = (value: unknown) => { const result = new Date(required(value, "contractDate")); if (Number.isNaN(result.valueOf())) throw new Error("contractDate is invalid."); return result; };
const decimal = (value: string | number | undefined, field: string) => { const result = new Prisma.Decimal(value === undefined || value === "" ? 0 : value); if (!result.isFinite() || result.isNegative()) throw new Error(`${field} cannot be negative.`); return result; };
const unit = (value?: string) => value && (Object.values(UnitOfMeasure) as string[]).includes(value) ? value as UnitOfMeasure : UnitOfMeasure.MT;
const output = (row: any) => ({ ...row, quantity: row.quantity.toString(), rate: row.rate.toString(), amountPkr: row.amountPkr.toString(), deliveredQty: row.deliveredQty.toString(), contractDate: row.contractDate.toISOString().slice(0, 10) });

async function refs(tx: Prisma.TransactionClient, context: Context, input: Input) {
  await assertVendorAreaAccess(tx, context.userId, context.companyId, required(input.vendorId, "vendorId"));
  const [vendor, product] = await Promise.all([tx.vendor.findFirst({ where: { id: required(input.vendorId, "vendorId"), companyId: context.companyId }, select: { id: true } }), tx.bulkProduct.findFirst({ where: { id: required(input.productId, "productId"), companyId: context.companyId }, select: { id: true } })]);
  if (!vendor) throw new Error("vendorId is invalid."); if (!product) throw new Error("productId is invalid.");
}

export async function listPurchaseContracts(context: Context) {
  const rows = await prisma.purchaseContract.findMany({ where: { companyId: context.companyId }, orderBy: [{ contractDate: "desc" }, { contractNo: "desc" }], take: 500 }); const [vendors, products] = await Promise.all([prisma.vendor.findMany({ where: { companyId: context.companyId, id: { in: rows.map((r) => r.vendorId) } }, select: { id: true, name: true } }), prisma.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: rows.map((r) => r.productId) } }, select: { id: true, name: true } })]); const vm = new Map(vendors.map((r) => [r.id, r.name])); const pm = new Map(products.map((r) => [r.id, r.name])); return rows.map((r) => ({ ...output(r), vendorName: vm.get(r.vendorId) ?? r.vendorId, productName: pm.get(r.productId) ?? r.productId }));
}

export async function createPurchaseContract(context: Context, input: Input) {
  return prisma.$transaction(async (tx) => { await enforcePermission(tx, context.userId, "purchase-contracts", PermissionAction.CREATE); const contractDate = date(input.contractDate); await assertWritableBusinessDate(tx, { ...context, transactionDate: contractDate, allowClosedDayOverride: input.allowClosedDayOverride }); await refs(tx, context, input); const quantity = decimal(input.quantity, "quantity"); if (quantity.isZero()) throw new Error("quantity must be greater than zero."); const rate = decimal(input.rate, "rate"); const row = await tx.purchaseContract.create({ data: { companyId: context.companyId, financialYearId: context.financialYearId, contractNo: input.contractNo?.trim() || await nextDocumentNumberInTransaction(tx, { ...context, prefix: DOCUMENT_PREFIXES.purchaseContract }), contractDate, vendorId: input.vendorId as string, productId: input.productId as string, quantity, unit: unit(input.unit), rate, amountPkr: input.amountPkr === undefined || input.amountPkr === "" ? quantity.mul(rate) : decimal(input.amountPkr, "amountPkr"), remarks: input.remarks?.trim() || null, status: (Object.values(ContractStatus) as string[]).includes(input.status ?? "") ? input.status as ContractStatus : ContractStatus.OPEN, createdById: context.userId } }); await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "PurchaseContract", entityId: row.id, after: row }); return output(row); });
}

export async function updatePurchaseContract(context: Context, id: string, input: Input) {
  return prisma.$transaction(async (tx) => { await enforcePermission(tx, context.userId, "purchase-contracts", PermissionAction.UPDATE); const before = await tx.purchaseContract.findFirstOrThrow({ where: { id, companyId: context.companyId } }); const contractDate = date(input.contractDate); await assertWritableBusinessDate(tx, { ...context, transactionDate: contractDate, allowClosedDayOverride: input.allowClosedDayOverride }); await refs(tx, context, input); const quantity = decimal(input.quantity, "quantity"); if (quantity.isZero()) throw new Error("quantity must be greater than zero."); const rate = decimal(input.rate, "rate"); const row = await tx.purchaseContract.update({ where: { id }, data: { contractNo: required(input.contractNo, "contractNo"), contractDate, vendorId: input.vendorId as string, productId: input.productId as string, quantity, unit: unit(input.unit), rate, amountPkr: input.amountPkr === undefined || input.amountPkr === "" ? quantity.mul(rate) : decimal(input.amountPkr, "amountPkr"), remarks: input.remarks?.trim() || null, status: (Object.values(ContractStatus) as string[]).includes(input.status ?? "") ? input.status as ContractStatus : before.status } }); await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "PurchaseContract", entityId: id, before, after: row }); return output(row); });
}
