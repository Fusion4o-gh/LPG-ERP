import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type EmptySaleInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  issueNo: string;
  customerId: string;
  itemId?: string;
  quantity?: number;
  unitPrice?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  remarks?: string;
  lines?: EmptySaleLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

type EmptySaleLineInput = {
  itemId: string;
  quantity: number;
  unitPrice: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function label(row: { code?: string | null; name?: string | null } | undefined, fallback: string) {
  return row ? [row.code, row.name].filter(Boolean).join(" - ") : fallback;
}

function normalizeLines(input: EmptySaleInput) {
  const rawLines: EmptySaleLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          itemId: input.itemId ?? "",
          quantity: input.quantity ?? 0,
          unitPrice: input.unitPrice ?? 0,
          gstPercent: input.gstPercent,
          gstAmount: input.gstAmount,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const unitPrice = decimal(line.unitPrice);
    if (unitPrice.lte(0)) throw new Error(`lines[${index}].unitPrice must be a positive number.`);
    const exGstAmount = unitPrice.times(quantity);
    const gstPercent = decimal(line.gstPercent);
    const gstAmount = line.gstAmount === undefined ? exGstAmount.times(gstPercent).div(100) : decimal(line.gstAmount);
    const incGstAmount = exGstAmount.plus(gstAmount);
    return { itemId: line.itemId, quantity, unitPrice, gstPercent, gstAmount, exGstAmount, incGstAmount };
  });
}

export async function emptySale(input: EmptySaleInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "empty-sales", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true, code: true, name: true } });
    const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
    const gstPayableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstPayable);
    const lines = normalizeLines(input);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    const totalExGstAmount = lines.reduce((sum, line) => sum.plus(line.exGstAmount), new Prisma.Decimal(0));
    const totalGstAmount = lines.reduce((sum, line) => sum.plus(line.gstAmount), new Prisma.Decimal(0));
    const totalIncGstAmount = totalExGstAmount.plus(totalGstAmount);
    const stockEntries = [];

    for (const line of lines) {
      stockEntries.push(
        await createStockLedgerEntry(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          itemId: line.itemId,
          cylinderState: CylinderState.EMPTY,
          direction: StockDirection.OUT,
          sourceType: StockSourceType.SALE_LPG,
          sourceId: input.issueNo,
          transactionDate: input.transactionDate,
          quantity: line.quantity,
          createdById: input.userId,
          partyType: PartyType.CUSTOMER,
          customerId: input.customerId,
        }),
      );
    }

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.issueNo,
      voucherType: VoucherType.SR,
      voucherDate: input.transactionDate,
      narration: input.remarks,
      sourceType: "EmptySale",
      sourceId: input.issueNo,
      createdById: input.userId,
      lines: [
        { accountId: customer.accountId, debit: totalIncGstAmount },
        { accountId: salesAccountId, credit: totalExGstAmount },
        ...(totalGstAmount.gt(0) ? [{ accountId: gstPayableAccountId, credit: totalGstAmount }] : []),
      ],
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "EmptySale",
      entityId: input.issueNo,
      after: {
        issueNo: input.issueNo,
        customerId: input.customerId,
        customer: label(customer, input.customerId),
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        totalExGstAmount: String(totalExGstAmount),
        totalGstAmount: String(totalGstAmount),
        totalIncGstAmount: String(totalIncGstAmount),
        lines: lines.map((line) => ({
          itemId: line.itemId,
          item: label(itemById.get(line.itemId), line.itemId),
          cylinderState: CylinderState.EMPTY,
          direction: StockDirection.OUT,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          gstPercent: String(line.gstPercent),
          gstAmount: String(line.gstAmount),
          exGstAmount: String(line.exGstAmount),
          incGstAmount: String(line.incGstAmount),
        })),
      },
    });

    return { issueNo: input.issueNo, stockEntries, voucher, totalExGstAmount, totalGstAmount, totalIncGstAmount };
  });
}
