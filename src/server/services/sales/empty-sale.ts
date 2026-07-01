import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { capDiscount, postCustomerReceipt } from "../accounting/settlement-vouchers.ts";
import { createBalancedVoucher, type VoucherLineInput } from "../accounting/vouchers.ts";
import { getWeightedAverageCost } from "../inventory/stock-ledger.ts";
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
  remarks?: string;
  lines?: EmptySaleLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
  discount?: string | number;
  amountReceived?: string | number;
  receiveMode?: string;
  bankId?: string;
  chequeNo?: string;
};

type EmptySaleLineInput = {
  itemId: string;
  quantity: number;
  unitPrice: string | number;
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
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const unitPrice = decimal(line.unitPrice);
    if (unitPrice.lte(0)) throw new Error(`lines[${index}].unitPrice must be a positive number.`);
    const amount = unitPrice.times(quantity);
    return { itemId: line.itemId, quantity, unitPrice, amount };
  });
}

export async function emptySale(input: EmptySaleInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "empty-sales", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true, code: true, name: true } });
    const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
    const lines = normalizeLines(input);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    const totalAmount = lines.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    const discountAmount = capDiscount(totalAmount, input.discount);
    const netReceivableAmount = totalAmount.minus(discountAmount);
    let salesDiscountAccountId: string | null = null;
    try {
      salesDiscountAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.salesDiscount);
    } catch {
      salesDiscountAccountId = null;
    }
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

    // COGS for empty cylinders sold
    const cogsAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.cogs);
    const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
    const cogsLines: VoucherLineInput[] = [];
    for (const line of lines) {
      const avgCost = await getWeightedAverageCost(tx, input.companyId, line.itemId, CylinderState.EMPTY);
      if (avgCost.gt(0) && line.quantity > 0) {
        const totalCost = avgCost.times(line.quantity);
        cogsLines.push({ accountId: cogsAccountId, debit: totalCost });
        cogsLines.push({ accountId: stockAccountId, credit: totalCost });
      }
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
        { accountId: customer.accountId, debit: netReceivableAmount },
        { accountId: salesAccountId, credit: totalAmount },
        ...(discountAmount.gt(0) && salesDiscountAccountId ? [{ accountId: salesDiscountAccountId, debit: discountAmount }] : []),
        ...cogsLines,
      ],
    });

    const amountReceived = decimal(input.amountReceived);
    if (amountReceived.gt(netReceivableAmount)) throw new Error("amountReceived cannot exceed net bill after discount.");
    const receiptVoucher = await postCustomerReceipt(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      userId: input.userId,
      transactionDate: input.transactionDate,
      allowClosedDayOverride: input.allowClosedDayOverride,
      customerId: input.customerId,
      partyAccountId: customer.accountId,
      amount: amountReceived,
      payMode: input.receiveMode,
      bankId: input.bankId,
      chequeNo: input.chequeNo,
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
        totalAmount: String(totalAmount),
        discountAmount: String(discountAmount),
        netReceivableAmount: String(netReceivableAmount),
        amountReceived: String(input.amountReceived ?? 0),
        receiveMode: input.receiveMode ?? "Credit",
        lines: lines.map((line) => ({
          itemId: line.itemId,
          item: label(itemById.get(line.itemId), line.itemId),
          cylinderState: CylinderState.EMPTY,
          direction: StockDirection.OUT,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          amount: String(line.amount),
        })),
      },
    });

    return {
      issueNo: input.issueNo,
      stockEntries,
      voucher,
      receiptVoucher,
      totalAmount,
      discountAmount,
      netReceivableAmount,
      amountReceived,
    };
  });
}
