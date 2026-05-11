import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type DecantingSaleInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  issueNo: string;
  customerId?: string;
  sourceItemId: string;
  sourceQuantity: number;
  decantedQuantity: string | number;
  unitPrice?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  remarks?: string;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function label(row: { code?: string | null; name?: string | null } | undefined, fallback: string) {
  return row ? [row.code, row.name].filter(Boolean).join(" - ") : fallback;
}

function normalizeInput(input: DecantingSaleInput) {
  if (!input.sourceItemId) throw new Error("sourceItemId is required.");
  if (!Number.isInteger(input.sourceQuantity) || input.sourceQuantity <= 0) {
    throw new Error("sourceQuantity must be a positive integer.");
  }
  const decantedQuantity = decimal(input.decantedQuantity);
  if (decantedQuantity.lte(0)) throw new Error("decantedQuantity must be a positive number.");
  const unitPrice = decimal(input.unitPrice);
  if (unitPrice.lt(0)) throw new Error("unitPrice cannot be negative.");
  const exGstAmount = decantedQuantity.times(unitPrice);
  const gstPercent = decimal(input.gstPercent);
  if (gstPercent.lt(0)) throw new Error("gstPercent cannot be negative.");
  const gstAmount = input.gstAmount === undefined ? exGstAmount.times(gstPercent).div(100) : decimal(input.gstAmount);
  const incGstAmount = exGstAmount.plus(gstAmount);
  return { decantedQuantity, unitPrice, gstPercent, gstAmount, exGstAmount, incGstAmount };
}

export async function decantingSale(input: DecantingSaleInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "decanting-sales", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const amounts = normalizeInput(input);
    const item = await tx.item.findFirst({
      where: { companyId: input.companyId, id: input.sourceItemId },
      select: { id: true, code: true, name: true },
    });
    if (!item) throw new Error("sourceItemId is invalid.");

    const stockEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: input.sourceItemId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.SALE_LPG,
      sourceId: input.issueNo,
      transactionDate: input.transactionDate,
      quantity: input.sourceQuantity,
      createdById: input.userId,
      partyType: input.customerId ? PartyType.CUSTOMER : undefined,
      customerId: input.customerId,
    });

    let customer: { accountId: string; code: string | null; name: string } | null = null;
    let voucher = null;
    if (amounts.incGstAmount.gt(0)) {
      if (!input.customerId) throw new Error("customerId is required when sale amount exists.");
      customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true, code: true, name: true } });
      const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
      const gstPayableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstPayable);
      voucher = await createBalancedVoucher(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        voucherNo: input.issueNo,
        voucherType: VoucherType.SR,
        voucherDate: input.transactionDate,
        narration: input.remarks,
        sourceType: "DecantingSale",
        sourceId: input.issueNo,
        createdById: input.userId,
        lines: [
          { accountId: customer.accountId, debit: amounts.incGstAmount },
          { accountId: salesAccountId, credit: amounts.exGstAmount },
          ...(amounts.gstAmount.gt(0) ? [{ accountId: gstPayableAccountId, credit: amounts.gstAmount }] : []),
        ],
      });
    }

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "DecantingSale",
      entityId: input.issueNo,
      after: {
        issueNo: input.issueNo,
        customerId: input.customerId,
        customer: customer ? label(customer, input.customerId ?? "") : "",
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        sourceItemId: input.sourceItemId,
        sourceItem: label(item, input.sourceItemId),
        sourceQuantity: input.sourceQuantity,
        decantedQuantity: String(amounts.decantedQuantity),
        unitPrice: String(amounts.unitPrice),
        gstPercent: String(amounts.gstPercent),
        totalExGstAmount: String(amounts.exGstAmount),
        totalGstAmount: String(amounts.gstAmount),
        totalIncGstAmount: String(amounts.incGstAmount),
        lines: [
          {
            section: "Decanting",
            itemId: input.sourceItemId,
            item: label(item, input.sourceItemId),
            cylinderState: CylinderState.FILLED,
            direction: StockDirection.OUT,
            quantity: input.sourceQuantity,
            sourceQuantity: input.sourceQuantity,
            decantedQuantity: String(amounts.decantedQuantity),
            unitPrice: String(amounts.unitPrice),
            gstPercent: String(amounts.gstPercent),
            gstAmount: String(amounts.gstAmount),
            exGstAmount: String(amounts.exGstAmount),
            incGstAmount: String(amounts.incGstAmount),
          },
        ],
      },
    });

    return {
      issueNo: input.issueNo,
      stockEntries: [stockEntry],
      voucher,
      totalExGstAmount: amounts.exGstAmount,
      totalGstAmount: amounts.gstAmount,
      totalIncGstAmount: amounts.incGstAmount,
    };
  });
}
