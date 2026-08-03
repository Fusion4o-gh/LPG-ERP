import { AuditAction, ContractStatus, ImportType, PermissionAction, Prisma, UnitOfMeasure } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { assertVendorAreaAccess } from "../user-management/area-access.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Input = { contractNo?: string; contractDate?: string; importType?: string; vendorId?: string; productId?: string; purchaseType?: string; quantity?: string | number; unit?: string; rateUsd?: string | number; exchangeRate?: string | number; status?: string; remarks?: string; allowClosedDayOverride?: boolean };

const text = (value?: string) => value?.trim() || null;
function required(value: unknown, name: string) { if (value === undefined || value === null || String(value).trim() === "") throw new Error(`${name} is required.`); return String(value).trim(); }
function decimal(value: string | number | undefined, name: string, fallback = "0") { const result = new Prisma.Decimal(value === undefined || value === "" ? fallback : value); if (!result.isFinite() || result.isNegative()) throw new Error(`${name} cannot be negative.`); return result; }
function enumValue<T extends string>(value: string | undefined, values: readonly T[], name: string, fallback: T): T { const result = value || fallback; if (!values.includes(result as T)) throw new Error(`${name} is invalid.`); return result as T; }
function dateValue(value?: string) { const result = new Date(required(value, "contractDate")); if (Number.isNaN(result.valueOf())) throw new Error("contractDate is invalid."); return result; }

async function references(tx: Prisma.TransactionClient, context: Context, input: Input) {
  await assertVendorAreaAccess(tx, context.userId, context.companyId, required(input.vendorId, "vendorId"));
  const [vendor, product] = await Promise.all([
    tx.vendor.findFirst({ where: { id: required(input.vendorId, "vendorId"), companyId: context.companyId }, select: { id: true } }),
    tx.bulkProduct.findFirst({ where: { id: required(input.productId, "productId"), companyId: context.companyId }, select: { id: true } }),
  ]);
  if (!vendor) throw new Error("vendorId is invalid.");
  if (!product) throw new Error("productId is invalid.");
}

function output(row: any) { return { ...row, quantity: row.quantity.toString(), rateUsd: row.rateUsd.toString(), exchangeRate: row.exchangeRate.toString(), amountUsd: row.amountUsd.toString(), amountPkr: row.amountPkr.toString(), contractDate: row.contractDate.toISOString().slice(0, 10) }; }

export async function listImportContracts(context: Context, importType?: string) {
  const rows = await prisma.importContract.findMany({ where: { companyId: context.companyId, ...(importType ? { importType: importType as ImportType } : {}) }, orderBy: [{ contractDate: "desc" }, { contractNo: "desc" }], take: 500 });
  const [vendors, products] = await Promise.all([
    prisma.vendor.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.vendorId) } }, select: { id: true, name: true } }),
    prisma.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.productId) } }, select: { id: true, name: true } }),
  ]);
  const vendorNames = new Map(vendors.map((row) => [row.id, row.name])); const productNames = new Map(products.map((row) => [row.id, row.name]));
  return rows.map((row) => ({ ...output(row), vendorName: vendorNames.get(row.vendorId) ?? row.vendorId, productName: productNames.get(row.productId) ?? row.productId }));
}

export async function createImportContract(context: Context, input: Input) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "import-contracts", PermissionAction.CREATE);
    const contractDate = dateValue(input.contractDate);
    await references(tx, context, input);
    const quantity = decimal(input.quantity, "quantity"); if (quantity.isZero()) throw new Error("quantity must be greater than zero.");
    await assertWritableBusinessDate(tx, { ...context, transactionDate: contractDate, allowClosedDayOverride: input.allowClosedDayOverride });
    const rateUsd = decimal(input.rateUsd, "rateUsd"); const exchangeRate = decimal(input.exchangeRate, "exchangeRate");
    const amountUsd = quantity.mul(rateUsd); const amountPkr = amountUsd.mul(exchangeRate);
    const row = await tx.importContract.create({ data: { companyId: context.companyId, financialYearId: context.financialYearId, contractNo: text(input.contractNo) ?? await nextDocumentNumberInTransaction(tx, { ...context, prefix: DOCUMENT_PREFIXES.importContract }), contractDate, importType: enumValue(input.importType, Object.values(ImportType), "importType", ImportType.TAFTAN), vendorId: input.vendorId as string, productId: input.productId as string, purchaseType: text(input.purchaseType), quantity, unit: enumValue(input.unit, Object.values(UnitOfMeasure), "unit", UnitOfMeasure.MT), rateUsd, exchangeRate, amountUsd, amountPkr, status: enumValue(input.status, Object.values(ContractStatus), "status", ContractStatus.OPEN), remarks: text(input.remarks), createdById: context.userId } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "ImportContract", entityId: row.id, after: row });
    return output(row);
  });
}

export async function updateImportContract(context: Context, id: string, input: Input) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "import-contracts", PermissionAction.UPDATE);
    const before = await tx.importContract.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const contractDate = dateValue(input.contractDate); await assertWritableBusinessDate(tx, { ...context, transactionDate: contractDate, allowClosedDayOverride: input.allowClosedDayOverride }); await references(tx, context, input);
    const quantity = decimal(input.quantity, "quantity"); if (quantity.isZero()) throw new Error("quantity must be greater than zero."); const rateUsd = decimal(input.rateUsd, "rateUsd"); const exchangeRate = decimal(input.exchangeRate, "exchangeRate");
    const row = await tx.importContract.update({ where: { id }, data: { contractNo: required(input.contractNo, "contractNo"), contractDate, importType: enumValue(input.importType, Object.values(ImportType), "importType", before.importType), vendorId: input.vendorId as string, productId: input.productId as string, purchaseType: text(input.purchaseType), quantity, unit: enumValue(input.unit, Object.values(UnitOfMeasure), "unit", before.unit), rateUsd, exchangeRate, amountUsd: quantity.mul(rateUsd), amountPkr: quantity.mul(rateUsd).mul(exchangeRate), status: enumValue(input.status, Object.values(ContractStatus), "status", before.status), remarks: text(input.remarks) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "ImportContract", entityId: id, before, after: row }); return output(row);
  });
}
