import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
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
  gstPercent?: string | number;
  gstAmount?: string | number;
  remarks?: string;
  lines?: CylinderReturnLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

type CylinderReturnLineInput = {
  itemId: string;
  returnType?: "Empty" | "Filled" | string;
  quantity: number;
  unitPrice?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
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
          gstPercent: input.gstPercent,
          gstAmount: input.gstAmount,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const returnType = normalizeReturnType(line.returnType);
    const unitPrice = decimal(line.unitPrice);
    if (returnType === "Filled" && unitPrice.lte(0)) throw new Error(`lines[${index}].unitPrice must be positive for filled returns.`);
    const exGstAmount = returnType === "Filled" ? unitPrice.times(quantity) : new Prisma.Decimal(0);
    const gstPercent = decimal(line.gstPercent);
    const gstAmount = returnType === "Filled" ? (line.gstAmount === undefined ? exGstAmount.times(gstPercent).div(100) : decimal(line.gstAmount)) : new Prisma.Decimal(0);
    const totalAmount = exGstAmount.plus(gstAmount);
    return { itemId: line.itemId, returnType, quantity, unitPrice, gstPercent, gstAmount, exGstAmount, totalAmount };
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
    const totalExGstAmount = lines.reduce((sum, line) => sum.plus(line.exGstAmount), new Prisma.Decimal(0));
    const totalGstAmount = lines.reduce((sum, line) => sum.plus(line.gstAmount), new Prisma.Decimal(0));
    const totalReturnAmount = totalExGstAmount.plus(totalGstAmount);

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

      await decrementEmptyOwed(tx, input.customerId, line.itemId, line.quantity);
    }

    let voucher = null;
    if (totalReturnAmount.gt(0)) {
      const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
      const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
      const gstPayableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstPayable);
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
          { accountId: salesAccountId, debit: totalExGstAmount },
          ...(totalGstAmount.gt(0) ? [{ accountId: gstPayableAccountId, debit: totalGstAmount }] : []),
          { accountId: customer.accountId, credit: totalReturnAmount },
        ],
      });
    }

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
        totalExGstAmount: String(totalExGstAmount),
        totalGstAmount: String(totalGstAmount),
        totalReturnAmount: String(totalReturnAmount),
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
            gstPercent: String(line.gstPercent),
            gstAmount: String(line.gstAmount),
            exGstAmount: String(line.exGstAmount),
            totalAmount: String(line.totalAmount),
          };
        }),
      },
    });

    return { returnNo: input.returnNo, stockEntries, voucher, totalExGstAmount, totalGstAmount, totalReturnAmount };
  });
}
