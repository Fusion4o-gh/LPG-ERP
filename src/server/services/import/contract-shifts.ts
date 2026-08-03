import { AuditAction, ContractShiftKind, ContractStatus, ImportType, PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Input = { kind?: string; recordId?: string; targetContractId?: string; transactionDate?: string; remarks?: string; allowClosedDayOverride?: boolean };
const required = (value: unknown, field: string) => { if (value === undefined || value === null || String(value).trim() === "") throw new Error(`${field} is required.`); return String(value).trim(); };
const date = (value: unknown) => { const result = new Date(required(value, "transactionDate")); if (Number.isNaN(result.valueOf())) throw new Error("transactionDate is invalid."); return result; };
const output = (row: any) => ({ ...row, quantity: (row.quantity ?? row.quantityLoaded ?? 0).toString(), transactionDate: (row.transactionDate ?? row.loadingDate).toISOString().slice(0, 10) });

export async function listContractShifts(context: Context) {
  return (await prisma.contractShift.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId }, orderBy: { createdAt: "desc" }, take: 300 })).map(output);
}

export async function shiftContract(context: Context, input: Input) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "contract-shifts", PermissionAction.CREATE);
    const kind = input.kind === "LOCAL_PURCHASE" ? ContractShiftKind.LOCAL_PURCHASE : input.kind === "IMPORT_LOADING" ? ContractShiftKind.IMPORT_LOADING : (() => { throw new Error("kind must be IMPORT_LOADING or LOCAL_PURCHASE."); })();
    const recordId = required(input.recordId, "recordId"); const targetContractId = required(input.targetContractId, "targetContractId"); const transactionDate = date(input.transactionDate);
    await assertWritableBusinessDate(tx, { ...context, transactionDate, allowClosedDayOverride: input.allowClosedDayOverride });
    if (kind === ContractShiftKind.IMPORT_LOADING) {
      const loading = await tx.loading.findFirst({ where: { id: recordId, companyId: context.companyId }, include: { contract: { select: { id: true, importType: true, productId: true } } } });
      if (!loading) throw new Error("Import loading record is invalid."); if (loading.contractId === targetContractId) throw new Error("Target contract must be different from the source contract.");
      const target = await tx.importContract.findFirst({ where: { id: targetContractId, companyId: context.companyId }, select: { id: true, importType: true, productId: true, quantity: true, status: true } });
      if (!target) throw new Error("Target import contract is invalid."); if (target.importType !== loading.contract.importType || target.productId !== loading.contract.productId) throw new Error("Target contract must match the loading import type and product."); if (target.status === ContractStatus.CANCELLED || target.status === ContractStatus.DISAPPROVED) throw new Error("Cannot shift to a cancelled or disapproved contract.");
      const loaded = await tx.loading.aggregate({ where: { contractId: target.id }, _sum: { quantityLoaded: true } }); if (new Prisma.Decimal(loaded._sum.quantityLoaded ?? 0).plus(loading.quantityLoaded).gt(target.quantity)) throw new Error("Shift quantity exceeds the target contract quantity.");
      const row = await tx.loading.update({ where: { id: loading.id }, data: { contractId: target.id, loadingType: target.importType } }); const shift = await tx.contractShift.create({ data: { companyId: context.companyId, financialYearId: context.financialYearId, kind, recordId, sourceContractId: loading.contractId, targetContractId, quantity: loading.quantityLoaded, transactionDate, remarks: input.remarks?.trim() || null, createdById: context.userId } });
      await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Loading", entityId: loading.id, before: loading, after: row }); await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "ContractShift", entityId: shift.id, after: shift }); return { ...output(shift), record: output(row) };
    }
    const purchase = await tx.localPurchase.findFirst({ where: { id: recordId, companyId: context.companyId }, include: { contract: { select: { id: true, vendorId: true, productId: true, quantity: true, deliveredQty: true, status: true } } } });
    if (!purchase?.contract) throw new Error("Local purchase record must have a source contract."); if (purchase.contractId === targetContractId) throw new Error("Target contract must be different from the source contract.");
    const target = await tx.purchaseContract.findFirst({ where: { id: targetContractId, companyId: context.companyId }, select: { id: true, vendorId: true, productId: true, quantity: true, deliveredQty: true, status: true } });
    if (!target) throw new Error("Target purchase contract is invalid."); if (target.vendorId !== purchase.vendorId || target.productId !== purchase.productId) throw new Error("Target contract must match the local purchase vendor and product."); if (target.status === ContractStatus.CANCELLED || target.status === ContractStatus.DISAPPROVED) throw new Error("Cannot shift to a cancelled or disapproved contract."); if (target.deliveredQty.plus(purchase.quantity).gt(target.quantity)) throw new Error("Shift quantity exceeds the target contract quantity.");
    const sourceDelivered = purchase.contract.deliveredQty.minus(purchase.quantity); const targetDelivered = target.deliveredQty.plus(purchase.quantity);
    const row = await tx.localPurchase.update({ where: { id: purchase.id }, data: { contractId: target.id } }); await tx.purchaseContract.update({ where: { id: purchase.contract.id }, data: { deliveredQty: sourceDelivered, status: sourceDelivered.lt(purchase.contract.quantity) ? ContractStatus.OPEN : purchase.contract.status } }); await tx.purchaseContract.update({ where: { id: target.id }, data: { deliveredQty: targetDelivered, status: targetDelivered.gte(target.quantity) ? ContractStatus.CLOSED : target.status } });
    const shift = await tx.contractShift.create({ data: { companyId: context.companyId, financialYearId: context.financialYearId, kind, recordId, sourceContractId: purchase.contract.id, targetContractId, quantity: purchase.quantity, transactionDate, remarks: input.remarks?.trim() || null, createdById: context.userId } }); await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "LocalPurchase", entityId: purchase.id, before: purchase, after: row }); await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "ContractShift", entityId: shift.id, after: shift }); return { ...output(shift), record: output(row) };
  });
}
