import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { capDiscount, postVendorSettlement } from "../accounting/settlement-vouchers.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type BasePurchaseInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  receiptNo: string;
  vendorId: string;
  remarks?: string;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
  discount?: string | number;
  amountPaid?: string | number;
  bankAmount?: string | number;
  cashAmount?: string | number;
  payMode?: string;
  bankId?: string;
  chequeNo?: string;
};

type PurchaseEmptyCylinderInput = BasePurchaseInput & {
  itemId?: string;
  quantity?: number;
  unitPrice?: string | number;
  unitCost?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  lines?: PurchaseEmptyCylinderLineInput[];
};

type PurchaseEmptyCylinderLineInput = {
  itemId: string;
  quantity: number;
  unitPrice?: string | number;
  unitCost?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
};

type PurchaseOtherInput = BasePurchaseInput & {
  accountId?: string;
  itemId?: string;
  description?: string;
  quantity?: number;
  amount?: string | number;
  unitPrice?: string | number;
  unitCost?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  stockIn?: boolean;
  cylinderState?: "FILLED" | "EMPTY" | CylinderState;
  lines?: PurchaseOtherLineInput[];
};

type PurchaseOtherLineInput = {
  accountId?: string;
  itemId?: string;
  description?: string;
  quantity?: number;
  amount?: string | number;
  unitPrice?: string | number;
  unitCost?: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  stockIn?: boolean;
  cylinderState?: "FILLED" | "EMPTY" | CylinderState;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function label(row: { code?: string | null; name?: string | null } | undefined, fallback: string) {
  return row ? [row.code, row.name].filter(Boolean).join(" - ") : fallback;
}

function normalizeCylinderState(value: PurchaseOtherLineInput["cylinderState"]) {
  return String(value) === CylinderState.FILLED ? CylinderState.FILLED : CylinderState.EMPTY;
}

function normalizeEmptyLines(input: PurchaseEmptyCylinderInput) {
  const rawLines: PurchaseEmptyCylinderLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          itemId: input.itemId ?? "",
          quantity: input.quantity ?? 0,
          unitPrice: input.unitPrice,
          unitCost: input.unitCost,
          gstPercent: input.gstPercent,
          gstAmount: input.gstAmount,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const unitPrice = decimal(line.unitPrice ?? line.unitCost);
    if (unitPrice.lte(0)) throw new Error(`lines[${index}].unitPrice must be a positive number.`);
    const exGstAmount = unitPrice.times(quantity);
    const gstPercent = decimal(line.gstPercent);
    const gstAmount = line.gstAmount === undefined ? exGstAmount.times(gstPercent).div(100) : decimal(line.gstAmount);
    const incGstAmount = exGstAmount.plus(gstAmount);
    return { itemId: line.itemId, quantity, unitPrice, gstPercent, gstAmount, exGstAmount, incGstAmount };
  });
}

function normalizeOtherLines(input: PurchaseOtherInput) {
  const rawLines: PurchaseOtherLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          accountId: input.accountId,
          itemId: input.itemId,
          description: input.description,
          quantity: input.quantity,
          amount: input.amount,
          unitPrice: input.unitPrice,
          unitCost: input.unitCost,
          gstPercent: input.gstPercent,
          gstAmount: input.gstAmount,
          stockIn: input.stockIn,
          cylinderState: input.cylinderState,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.accountId && !line.itemId && !line.description) throw new Error(`lines[${index}].accountId, itemId, or description is required.`);
    const quantity = line.quantity === undefined ? undefined : Number(line.quantity);
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0)) throw new Error(`lines[${index}].quantity must be a positive number.`);
    const unitPrice = line.unitPrice === undefined && line.unitCost === undefined ? undefined : decimal(line.unitPrice ?? line.unitCost);
    const amount = line.amount === undefined ? (unitPrice && quantity !== undefined ? unitPrice.times(quantity) : new Prisma.Decimal(0)) : decimal(line.amount);
    if (amount.lte(0)) throw new Error(`lines[${index}].amount must be a positive number.`);
    const gstPercent = decimal(line.gstPercent);
    const gstAmount = line.gstAmount === undefined ? amount.times(gstPercent).div(100) : decimal(line.gstAmount);
    const incGstAmount = amount.plus(gstAmount);
    const stockIn = Boolean(line.stockIn);
    if (stockIn && !line.itemId) throw new Error(`lines[${index}].itemId is required for stock entry.`);
    if (stockIn && (quantity === undefined || !Number.isInteger(quantity))) throw new Error(`lines[${index}].quantity must be a positive integer for stock entry.`);
    return { accountId: line.accountId, itemId: line.itemId, description: line.description, quantity, unitPrice, amount, gstPercent, gstAmount, incGstAmount, stockIn, cylinderState: normalizeCylinderState(line.cylinderState) };
  });
}

export async function purchaseEmptyCylinder(input: PurchaseEmptyCylinderInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "purchase-filled-cylinders", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: input.vendorId }, select: { accountId: true, code: true, name: true } });
    const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
    const gstReceivableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstReceivable);
    const lines = normalizeEmptyLines(input);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    const totalExGstAmount = lines.reduce((sum, line) => sum.plus(line.exGstAmount), new Prisma.Decimal(0));
    const totalGstAmount = lines.reduce((sum, line) => sum.plus(line.gstAmount), new Prisma.Decimal(0));
    const totalIncGstAmount = totalExGstAmount.plus(totalGstAmount);
    const discountAmount = capDiscount(totalIncGstAmount, input.discount);
    const netPayableAmount = totalIncGstAmount.minus(discountAmount);
    let purchaseDiscountAccountId: string | null = null;
    try {
      purchaseDiscountAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.purchaseDiscount);
    } catch {
      purchaseDiscountAccountId = null;
    }
    const stockEntries = [];

    for (const line of lines) {
      stockEntries.push(
        await createStockLedgerEntry(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          itemId: line.itemId,
          cylinderState: CylinderState.EMPTY,
          unitCost: line.unitPrice,
          direction: StockDirection.IN,
          sourceType: StockSourceType.PURCHASE_FILLED,
          sourceId: input.receiptNo,
          transactionDate: input.transactionDate,
          quantity: line.quantity,
          createdById: input.userId,
          partyType: PartyType.VENDOR,
          vendorId: input.vendorId,
        }),
      );
    }

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.receiptNo,
      voucherType: VoucherType.JV,
      voucherDate: input.transactionDate,
      narration: input.remarks,
      sourceType: "PurchaseEmptyCylinder",
      sourceId: input.receiptNo,
      createdById: input.userId,
      lines: [
        { accountId: stockAccountId, debit: totalExGstAmount },
        ...(totalGstAmount.gt(0) ? [{ accountId: gstReceivableAccountId, debit: totalGstAmount }] : []),
        ...(discountAmount.gt(0) && purchaseDiscountAccountId ? [{ accountId: purchaseDiscountAccountId, credit: discountAmount }] : []),
        { accountId: vendor.accountId, credit: netPayableAmount },
      ],
    });

    const bankAmount = decimal(input.bankAmount);
    const cashAmount = decimal(input.cashAmount);
    const legacyAmountPaid = decimal(input.amountPaid);
    const amountPaid = bankAmount.gt(0) || cashAmount.gt(0) ? bankAmount.plus(cashAmount) : legacyAmountPaid;
    if (amountPaid.gt(netPayableAmount)) throw new Error("amountPaid cannot exceed net payable after discount.");
    const settlement = await postVendorSettlement(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      userId: input.userId,
      transactionDate: input.transactionDate,
      allowClosedDayOverride: input.allowClosedDayOverride,
      partyAccountId: vendor.accountId,
      amount: amountPaid,
      bankAmount,
      cashAmount,
      payMode: input.payMode,
      bankId: input.bankId,
      chequeNo: input.chequeNo,
    });
    const paymentVoucher = settlement.bankPaymentVoucher ?? settlement.cashPaymentVoucher;

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "PurchaseEmptyCylinder",
      entityId: input.receiptNo,
      after: {
        receiptNo: input.receiptNo,
        vendorId: input.vendorId,
        vendor: label(vendor, input.vendorId),
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        totalExGstAmount: String(totalExGstAmount),
        totalGstAmount: String(totalGstAmount),
        totalIncGstAmount: String(totalIncGstAmount),
        discountAmount: String(discountAmount),
        netPayableAmount: String(netPayableAmount),
        amountPaid: String(input.amountPaid ?? 0),
        payMode: input.payMode ?? "Credit",
        lines: lines.map((line) => ({
          itemId: line.itemId,
          item: label(itemById.get(line.itemId), line.itemId),
          cylinderState: CylinderState.EMPTY,
          direction: StockDirection.IN,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          gstPercent: String(line.gstPercent),
          gstAmount: String(line.gstAmount),
          exGstAmount: String(line.exGstAmount),
          incGstAmount: String(line.incGstAmount),
        })),
      },
    });

    return { receiptNo: input.receiptNo, stockEntries, voucher, paymentVoucher, totalExGstAmount, totalGstAmount, totalIncGstAmount, discountAmount, netPayableAmount, amountPaid };
  });
}

export async function purchaseOther(input: PurchaseOtherInput) {
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
    const totalIncGstAmount = totalExGstAmount.plus(totalGstAmount);
    const discountAmount = capDiscount(totalIncGstAmount, input.discount);
    const netPayableAmount = totalIncGstAmount.minus(discountAmount);
    let purchaseDiscountAccountId: string | null = null;
    try {
      purchaseDiscountAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.purchaseDiscount);
    } catch {
      purchaseDiscountAccountId = null;
    }
    const debitByAccount = new Map<string, Prisma.Decimal>();
    const stockEntries = [];

    for (const line of lines) {
      const accountId = line.accountId ?? stockAccountId;
      debitByAccount.set(accountId, (debitByAccount.get(accountId) ?? new Prisma.Decimal(0)).plus(line.amount));
      if (line.stockIn && line.itemId && line.quantity !== undefined) {
        stockEntries.push(
          await createStockLedgerEntry(tx, {
            companyId: input.companyId,
            financialYearId: input.financialYearId,
            itemId: line.itemId,
            cylinderState: line.cylinderState,
            unitCost: line.unitPrice,
            direction: StockDirection.IN,
            sourceType: StockSourceType.PURCHASE_FILLED,
            sourceId: input.receiptNo,
            transactionDate: input.transactionDate,
            quantity: line.quantity,
            createdById: input.userId,
            partyType: PartyType.VENDOR,
            vendorId: input.vendorId,
          }),
        );
      }
    }

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.receiptNo,
      voucherType: VoucherType.JV,
      voucherDate: input.transactionDate,
      narration: input.remarks,
      sourceType: "PurchaseOther",
      sourceId: input.receiptNo,
      createdById: input.userId,
      lines: [
        ...[...debitByAccount.entries()].map(([accountId, debit]) => ({ accountId, debit })),
        ...(totalGstAmount.gt(0) ? [{ accountId: gstReceivableAccountId, debit: totalGstAmount }] : []),
        ...(discountAmount.gt(0) && purchaseDiscountAccountId ? [{ accountId: purchaseDiscountAccountId, credit: discountAmount }] : []),
        { accountId: vendor.accountId, credit: netPayableAmount },
      ],
    });

    const bankAmount = decimal(input.bankAmount);
    const cashAmount = decimal(input.cashAmount);
    const legacyAmountPaid = decimal(input.amountPaid);
    const amountPaid = bankAmount.gt(0) || cashAmount.gt(0) ? bankAmount.plus(cashAmount) : legacyAmountPaid;
    if (amountPaid.gt(netPayableAmount)) throw new Error("amountPaid cannot exceed net payable after discount.");
    const settlement = await postVendorSettlement(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      userId: input.userId,
      transactionDate: input.transactionDate,
      allowClosedDayOverride: input.allowClosedDayOverride,
      partyAccountId: vendor.accountId,
      amount: amountPaid,
      bankAmount,
      cashAmount,
      payMode: input.payMode,
      bankId: input.bankId,
      chequeNo: input.chequeNo,
    });
    const paymentVoucher = settlement.bankPaymentVoucher ?? settlement.cashPaymentVoucher;

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "PurchaseOther",
      entityId: input.receiptNo,
      after: {
        receiptNo: input.receiptNo,
        vendorId: input.vendorId,
        vendor: label(vendor, input.vendorId),
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        totalExGstAmount: String(totalExGstAmount),
        totalGstAmount: String(totalGstAmount),
        totalIncGstAmount: String(totalIncGstAmount),
        discountAmount: String(discountAmount),
        netPayableAmount: String(netPayableAmount),
        amountPaid: String(input.amountPaid ?? 0),
        payMode: input.payMode ?? "Credit",
        lines: lines.map((line) => ({
          accountId: line.accountId,
          account: line.accountId ? label(accountById.get(line.accountId), line.accountId) : "Stock",
          itemId: line.itemId,
          item: line.itemId ? label(itemById.get(line.itemId), line.itemId) : "",
          description: line.description,
          cylinderState: line.stockIn ? line.cylinderState : "",
          direction: line.stockIn ? StockDirection.IN : "",
          quantity: line.quantity,
          unitPrice: line.unitPrice === undefined ? "" : String(line.unitPrice),
          gstPercent: String(line.gstPercent),
          gstAmount: String(line.gstAmount),
          exGstAmount: String(line.amount),
          incGstAmount: String(line.incGstAmount),
        })),
      },
    });

    return { receiptNo: input.receiptNo, stockEntries, voucher, paymentVoucher, totalExGstAmount, totalGstAmount, totalIncGstAmount, discountAmount, netPayableAmount, amountPaid };
  });
}
