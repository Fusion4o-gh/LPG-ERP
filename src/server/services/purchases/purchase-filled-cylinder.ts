import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type PurchaseFilledCylinderInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  issueNo: string;
  vendorId: string;
  itemId: string;
  quantity: number;
  unitCost: string | number;
  gstAmount?: string | number;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

export async function purchaseFilledCylinder(input: PurchaseFilledCylinderInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "purchase-filled-cylinders", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: input.vendorId }, select: { accountId: true } });
    const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
    const gstReceivableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstReceivable);
    const grossAmount = new Prisma.Decimal(input.unitCost).times(input.quantity);
    const gstAmount = new Prisma.Decimal(input.gstAmount ?? 0);
    const payableAmount = grossAmount.plus(gstAmount);

    const stockEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: input.itemId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.IN,
      sourceType: StockSourceType.PURCHASE_FILLED,
      sourceId: input.issueNo,
      transactionDate: input.transactionDate,
      quantity: input.quantity,
      createdById: input.userId,
      partyType: PartyType.VENDOR,
      vendorId: input.vendorId,
    });

    await tx.vendorCylinderReturnBalance.upsert({
      where: { vendorId_itemId: { vendorId: input.vendorId, itemId: input.itemId } },
      update: { emptyDue: { increment: input.quantity } },
      create: { vendorId: input.vendorId, itemId: input.itemId, emptyDue: input.quantity },
    });

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.issueNo,
      voucherType: VoucherType.JV,
      voucherDate: input.transactionDate,
      sourceType: "PurchaseFilledCylinder",
      sourceId: input.issueNo,
      createdById: input.userId,
      lines: [
        { accountId: stockAccountId, debit: grossAmount },
        ...(gstAmount.gt(0) ? [{ accountId: gstReceivableAccountId, debit: gstAmount }] : []),
        { accountId: vendor.accountId, credit: payableAmount },
      ],
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "PurchaseFilledCylinder",
      entityId: input.issueNo,
      after: { ...input, unitCost: String(input.unitCost), gstAmount: String(input.gstAmount ?? 0) },
    });

    return { voucher, stockEntries: [stockEntry] };
  });
}
