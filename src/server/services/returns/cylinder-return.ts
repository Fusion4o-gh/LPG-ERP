import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { capDiscount, postCustomerRefund } from "../accounting/settlement-vouchers.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type CylinderReturnInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  returnNo: string;
  customerId: string;
  itemId?: string;
  quantity?: number;
  returnType?: "Empty" | "Filled" | string;
  unitPrice?: string | number;
  remarks?: string;
  lines?: CylinderReturnLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
  discount?: string | number;
  amountPaid?: string | number;
  payMode?: string;
  bankId?: string;
  chequeNo?: string;
};

type CylinderReturnLineInput = {
  itemId: string;
  returnType?: "Empty" | "Filled" | string;
  quantity: number;
  unitPrice?: string | number;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function normalizeReturnType(value: string | undefined) {
  return String(value ?? "Empty").toLowerCase() === "filled" ? "Filled" : "Empty";
}

function normalizeLines(input: CylinderReturnInput) {
  const rawLines: CylinderReturnLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          itemId: input.itemId ?? "",
          returnType: input.returnType ?? "Empty",
          quantity: input.quantity ?? 0,
          unitPrice: input.unitPrice,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const returnType = normalizeReturnType(line.returnType);
    const unitPrice = decimal(line.unitPrice);
    if (returnType === "Filled" && unitPrice.lte(0)) throw new Error(`lines[${index}].unitPrice must be positive for filled returns.`);
    const amount = returnType === "Filled" ? unitPrice.times(quantity) : new Prisma.Decimal(0);
    return { itemId: line.itemId, returnType, quantity, unitPrice, amount };
  });
}

async function decrementEmptyOwed(tx: Prisma.TransactionClient, customerId: string, itemId: string, quantity: number) {
  const balance = await tx.customerCylinderBalance.findUnique({
    where: { customerId_itemId: { customerId, itemId } },
    select: { emptyOwed: true },
  });
  if (!balance || balance.emptyOwed < quantity) {
    throw new Error("Customer does not owe enough empty cylinders for this return.");
  }
  await tx.customerCylinderBalance.update({
    where: { customerId_itemId: { customerId, itemId } },
    data: { emptyOwed: { decrement: quantity } },
  });
}

export async function cylinderReturn(input: CylinderReturnInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "cylinder-returns", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const lines = normalizeLines(input);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    const stockEntries = [];
    const totalAmount = lines.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    const discountAmount = capDiscount(totalAmount, input.discount);
    const netReturnAmount = totalAmount.minus(discountAmount);
    let salesDiscountAccountId: string | null = null;
    try {
      salesDiscountAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.salesDiscount);
    } catch {
      salesDiscountAccountId = null;
    }

    for (const line of lines) {
      const stockEntry = await createStockLedgerEntry(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        itemId: line.itemId,
        cylinderState: line.returnType === "Filled" ? CylinderState.FILLED : CylinderState.EMPTY,
        direction: StockDirection.IN,
        sourceType: StockSourceType.CYLINDER_RETURN,
        sourceId: input.returnNo,
        transactionDate: input.transactionDate,
        quantity: line.quantity,
        createdById: input.userId,
        partyType: PartyType.CUSTOMER,
        customerId: input.customerId,
      });
      stockEntries.push(stockEntry);

      if (line.returnType === "Empty") {
        await decrementEmptyOwed(tx, input.customerId, line.itemId, line.quantity);
      }
    }

    const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
    let voucher = null;
    if (netReturnAmount.gt(0)) {
      const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
      voucher = await createBalancedVoucher(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        voucherNo: input.returnNo,
        voucherType: VoucherType.JV,
        voucherDate: input.transactionDate,
        narration: input.remarks,
        sourceType: "CylinderReturn",
        sourceId: input.returnNo,
        createdById: input.userId,
        lines: [
          { accountId: salesAccountId, debit: totalAmount },
          ...(discountAmount.gt(0) && salesDiscountAccountId ? [{ accountId: salesDiscountAccountId, debit: discountAmount }] : []),
          { accountId: customer.accountId, credit: netReturnAmount },
        ],
      });
    }

    const amountPaid = decimal(input.amountPaid);
    if (amountPaid.gt(netReturnAmount)) throw new Error("amountPaid cannot exceed net return amount after discount.");
    const refundVoucher = netReturnAmount.gt(0)
      ? await postCustomerRefund(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          userId: input.userId,
          transactionDate: input.transactionDate,
          allowClosedDayOverride: input.allowClosedDayOverride,
          partyAccountId: customer.accountId,
          amount: amountPaid,
          payMode: input.payMode,
          bankId: input.bankId,
          chequeNo: input.chequeNo,
        })
      : null;

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "CylinderReturn",
      entityId: input.returnNo,
      after: {
        returnNo: input.returnNo,
        customerId: input.customerId,
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        totalAmount: String(totalAmount),
        discountAmount: String(discountAmount),
        netReturnAmount: String(netReturnAmount),
        amountPaid: String(input.amountPaid ?? 0),
        payMode: input.payMode ?? "Credit",
        lines: lines.map((line) => {
          const item = itemById.get(line.itemId);
          return {
            itemId: line.itemId,
            item: item ? [item.code, item.name].filter(Boolean).join(" - ") : line.itemId,
            returnType: line.returnType,
            cylinderState: line.returnType === "Filled" ? CylinderState.FILLED : CylinderState.EMPTY,
            direction: StockDirection.IN,
            quantity: line.quantity,
            unitPrice: String(line.unitPrice),
            amount: String(line.amount),
          };
        }),
      },
    });

    return {
      returnNo: input.returnNo,
      stockEntries,
      voucher,
      refundVoucher,
      totalAmount,
      discountAmount,
      netReturnAmount,
      amountPaid,
    };
  });
}
