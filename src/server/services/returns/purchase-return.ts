import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type BasePurchaseReturnInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  returnNo: string;
  vendorId: string;
  remarks?: string;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

type PurchaseReturnCylinderInput = BasePurchaseReturnInput & {
  itemId?: string;
  quantity?: number;
  unitPrice?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  lines?: PurchaseReturnCylinderLineInput[];
};

type PurchaseReturnCylinderLineInput = {
  itemId: string;
  quantity: number;
  unitPrice: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
};

type PurchaseReturnOtherInput = BasePurchaseReturnInput & {
  accountId?: string;
  itemId?: string;
  description?: string;
  quantity?: number;
  amount?: string | number;
  unitPrice?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  lines?: PurchaseReturnOtherLineInput[];
};

type PurchaseReturnOtherLineInput = {
  accountId?: string;
  itemId?: string;
  description?: string;
  quantity?: number;
  amount?: string | number;
  unitPrice?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function label(row: { code?: string | null; name?: string | null } | undefined, fallback: string) {
  return row ? [row.code, row.name].filter(Boolean).join(" - ") : fallback;
}

function normalizeCylinderLines(input: PurchaseReturnCylinderInput) {
  const rawLines: PurchaseReturnCylinderLineInput[] = input.lines?.length
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
    const totalAmount = exGstAmount.plus(gstAmount);
    return { itemId: line.itemId, quantity, unitPrice, gstPercent, gstAmount, exGstAmount, totalAmount };
  });
}

function normalizeOtherLines(input: PurchaseReturnOtherInput) {
  const rawLines: PurchaseReturnOtherLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          accountId: input.accountId,
          itemId: input.itemId,
          description: input.description,
          quantity: input.quantity,
          amount: input.amount,
          unitPrice: input.unitPrice,
          gstPercent: input.gstPercent,
          gstAmount: input.gstAmount,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.accountId && !line.itemId) throw new Error(`lines[${index}].accountId or itemId is required.`);
    const quantity = line.quantity === undefined ? undefined : Number(line.quantity);
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) throw new Error(`lines[${index}].quantity must be a positive number.`);
    const unitPrice = line.unitPrice === undefined ? undefined : decimal(line.unitPrice);
    const amount = line.amount === undefined ? (unitPrice && quantity !== undefined ? unitPrice.times(quantity) : new Prisma.Decimal(0)) : decimal(line.amount);
    if (amount.lte(0)) throw new Error(`lines[${index}].amount must be a positive number.`);
    const gstPercent = decimal(line.gstPercent);
    const gstAmount = line.gstAmount === undefined ? amount.times(gstPercent).div(100) : decimal(line.gstAmount);
    const totalAmount = amount.plus(gstAmount);
    return { accountId: line.accountId, itemId: line.itemId, description: line.description, quantity, unitPrice, amount, gstPercent, gstAmount, totalAmount };
  });
}

async function reduceVendorEmptyDue(tx: Prisma.TransactionClient, vendorId: string, itemId: string, quantity: number) {
  const balance = await tx.vendorCylinderReturnBalance.findUnique({
    where: { vendorId_itemId: { vendorId, itemId } },
    select: { emptyDue: true },
  });
  if (!balance) return;
  await tx.vendorCylinderReturnBalance.update({
    where: { vendorId_itemId: { vendorId, itemId } },
    data: { emptyDue: Math.max(0, balance.emptyDue - quantity) },
  });
}

export async function purchaseReturnCylinder(input: PurchaseReturnCylinderInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "purchase-filled-cylinders", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: input.vendorId }, select: { accountId: true, code: true, name: true } });
    const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
    const gstReceivableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstReceivable);
    const lines = normalizeCylinderLines(input);
    const items = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));
    const totalExGstAmount = lines.reduce((sum, line) => sum.plus(line.exGstAmount), new Prisma.Decimal(0));
    const totalGstAmount = lines.reduce((sum, line) => sum.plus(line.gstAmount), new Prisma.Decimal(0));
    const totalReturnAmount = totalExGstAmount.plus(totalGstAmount);
    const stockEntries = [];

    for (const line of lines) {
      const stockEntry = await createStockLedgerEntry(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        itemId: line.itemId,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.OUT,
        sourceType: StockSourceType.PURCHASE_RETURN,
        sourceId: input.returnNo,
        transactionDate: input.transactionDate,
        quantity: line.quantity,
        createdById: input.userId,
        partyType: PartyType.VENDOR,
        vendorId: input.vendorId,
      });
      stockEntries.push(stockEntry);
      await reduceVendorEmptyDue(tx, input.vendorId, line.itemId, line.quantity);
    }

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.returnNo,
      voucherType: VoucherType.JV,
      voucherDate: input.transactionDate,
      narration: input.remarks,
      sourceType: "PurchaseReturnCylinder",
      sourceId: input.returnNo,
      createdById: input.userId,
      lines: [
        { accountId: vendor.accountId, debit: totalReturnAmount },
        { accountId: stockAccountId, credit: totalExGstAmount },
        ...(totalGstAmount.gt(0) ? [{ accountId: gstReceivableAccountId, credit: totalGstAmount }] : []),
      ],
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "PurchaseReturnCylinder",
      entityId: input.returnNo,
      after: {
        returnNo: input.returnNo,
        returnType: "Cylinder",
        vendorId: input.vendorId,
        vendor: label(vendor, input.vendorId),
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        totalExGstAmount: String(totalExGstAmount),
        totalGstAmount: String(totalGstAmount),
        totalReturnAmount: String(totalReturnAmount),
        lines: lines.map((line) => ({
          itemId: line.itemId,
          item: label(itemById.get(line.itemId), line.itemId),
          returnType: "Cylinder",
          cylinderState: CylinderState.FILLED,
          direction: StockDirection.OUT,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          gstPercent: String(line.gstPercent),
          gstAmount: String(line.gstAmount),
          exGstAmount: String(line.exGstAmount),
          totalAmount: String(line.totalAmount),
        })),
      },
    });

    return { returnNo: input.returnNo, stockEntries, voucher, totalExGstAmount, totalGstAmount, totalReturnAmount };
  });
}

export async function purchaseReturnOther(input: PurchaseReturnOtherInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "purchase-filled-cylinders", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: input.vendorId }, select: { accountId: true, code: true, name: true } });
    const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
    const gstReceivableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstReceivable);
    const lines = normalizeOtherLines(input);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId).filter(Boolean) as string[])] } },
      select: { id: true, code: true, name: true },
    });
    const accountRows = await tx.chartAccount.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.accountId).filter(Boolean) as string[])] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    const accountById = new Map(accountRows.map((account) => [account.id, account]));
    const totalExGstAmount = lines.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    const totalGstAmount = lines.reduce((sum, line) => sum.plus(line.gstAmount), new Prisma.Decimal(0));
    const totalReturnAmount = totalExGstAmount.plus(totalGstAmount);

    const creditByAccount = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      const accountId = line.accountId ?? stockAccountId;
      creditByAccount.set(accountId, (creditByAccount.get(accountId) ?? new Prisma.Decimal(0)).plus(line.amount));
    }

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.returnNo,
      voucherType: VoucherType.JV,
      voucherDate: input.transactionDate,
      narration: input.remarks,
      sourceType: "PurchaseReturnOther",
      sourceId: input.returnNo,
      createdById: input.userId,
      lines: [
        { accountId: vendor.accountId, debit: totalReturnAmount },
        ...[...creditByAccount.entries()].map(([accountId, credit]) => ({ accountId, credit })),
        ...(totalGstAmount.gt(0) ? [{ accountId: gstReceivableAccountId, credit: totalGstAmount }] : []),
      ],
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "PurchaseReturnOther",
      entityId: input.returnNo,
      after: {
        returnNo: input.returnNo,
        returnType: "Other",
        vendorId: input.vendorId,
        vendor: label(vendor, input.vendorId),
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        totalExGstAmount: String(totalExGstAmount),
        totalGstAmount: String(totalGstAmount),
        totalReturnAmount: String(totalReturnAmount),
        lines: lines.map((line) => ({
          accountId: line.accountId,
          account: line.accountId ? label(accountById.get(line.accountId), line.accountId) : "Stock",
          itemId: line.itemId,
          item: line.itemId ? label(itemById.get(line.itemId), line.itemId) : "",
          description: line.description,
          returnType: "Other",
          quantity: line.quantity,
          unitPrice: line.unitPrice === undefined ? "" : String(line.unitPrice),
          gstPercent: String(line.gstPercent),
          gstAmount: String(line.gstAmount),
          exGstAmount: String(line.amount),
          totalAmount: String(line.totalAmount),
        })),
      },
    });

    return { returnNo: input.returnNo, voucher, stockEntries: [], totalExGstAmount, totalGstAmount, totalReturnAmount };
  });
}
