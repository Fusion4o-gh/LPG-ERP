import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { ACCOUNT_CODES, getAccountIdByCode, getBankAccountId, getCashAccountId } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { setGasCostRate } from "../pricing/gas-cost.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type PurchaseFilledCylinderInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  issueNo: string;
  vendorId: string;
  itemId?: string;
  quantity?: number;
  unitCost?: string | number;
  gstAmount?: string | number;
  gstPercent?: string | number;
  remarks?: string;
  elevenPointEightKgPrice?: string | number;
  lines?: PurchaseFilledCylinderLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
  discount?: string | number;
  amountPaid?: string | number;
  payMode?: "Credit" | "Cash" | "Bank" | string;
  bankId?: string;
  chequeNo?: string;
  chequeDate?: string | Date;
  locationId?: string;
};

type PurchaseFilledCylinderLineInput = {
  itemId: string;
  cylinderState?: "FILLED" | "EMPTY" | CylinderState;
  quantity: number;
  unitCost: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  emptyReturnQuantity?: number;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function normalizeCylinderState(value: PurchaseFilledCylinderLineInput["cylinderState"]) {
  return String(value) === CylinderState.EMPTY ? CylinderState.EMPTY : CylinderState.FILLED;
}

function normalizeLines(input: PurchaseFilledCylinderInput) {
  const rawLines: PurchaseFilledCylinderLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          itemId: input.itemId ?? "",
          cylinderState: CylinderState.FILLED,
          quantity: input.quantity ?? 0,
          unitCost: input.unitCost ?? 0,
          gstAmount: input.gstAmount,
          gstPercent: input.gstPercent,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const unitCost = decimal(line.unitCost);
    if (unitCost.lte(0)) throw new Error(`lines[${index}].unitCost must be a positive number.`);
    const exGstAmount = unitCost.times(quantity);
    const gstPercent = decimal(line.gstPercent);
    const gstAmount = line.gstAmount === undefined ? exGstAmount.times(gstPercent).div(100) : decimal(line.gstAmount);
    const incGstAmount = exGstAmount.plus(gstAmount);
    const emptyReturnQuantity = Number(line.emptyReturnQuantity ?? 0);
    if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`lines[${index}].emptyReturnQuantity must be a non-negative integer.`);
    return {
      itemId: line.itemId,
      cylinderState: normalizeCylinderState(line.cylinderState),
      quantity,
      unitCost,
      gstPercent,
      gstAmount,
      exGstAmount,
      incGstAmount,
      emptyReturnQuantity,
    };
  });
}

export async function purchaseFilledCylinder(input: PurchaseFilledCylinderInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "purchase-filled-cylinders", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: input.vendorId }, select: { accountId: true } });

    if (input.elevenPointEightKgPrice !== undefined) {
      const elevenPointEightKgPrice = decimal(input.elevenPointEightKgPrice);
      if (elevenPointEightKgPrice.gt(0)) {
        const company = await tx.company.findUniqueOrThrow({
          where: { id: input.companyId },
          select: { standardPurchaseCylinderKg: true },
        });
        const costPerKg = elevenPointEightKgPrice.dividedBy(company.standardPurchaseCylinderKg);
        await setGasCostRate(tx, {
          companyId: input.companyId,
          costPerKg,
          sourceType: "PURCHASE",
          sourceId: input.issueNo,
          userId: input.userId,
          effectiveFrom: input.transactionDate,
        });
      }
    }

    const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
    const gstReceivableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstReceivable);
    const lines = normalizeLines(input);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    const grossAmount = lines.reduce((sum, line) => sum.plus(line.exGstAmount), new Prisma.Decimal(0));
    const gstAmount = lines.reduce((sum, line) => sum.plus(line.gstAmount), new Prisma.Decimal(0));
    const payableAmount = grossAmount.plus(gstAmount);
    const discountRaw = decimal(input.discount);
    const discountAmount = discountRaw.gt(payableAmount) ? payableAmount : discountRaw;
    const netPayableAmount = payableAmount.minus(discountAmount);
    let purchaseDiscountAccountId: string | null = null;
    try {
      purchaseDiscountAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.purchaseDiscount);
    } catch {
      purchaseDiscountAccountId = null;
    }
    const stockEntries = [];

    for (const line of lines) {
      const stockEntry = await createStockLedgerEntry(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        itemId: line.itemId,
        cylinderState: line.cylinderState,
        unitCost: line.cylinderState === CylinderState.FILLED ? line.unitCost : undefined,
        direction: StockDirection.IN,
        sourceType: StockSourceType.PURCHASE_FILLED,
        sourceId: input.issueNo,
        transactionDate: input.transactionDate,
        quantity: line.quantity,
        createdById: input.userId,
        partyType: PartyType.VENDOR,
        vendorId: input.vendorId,
        locationId: input.locationId,
      });
      stockEntries.push(stockEntry);

      if (line.cylinderState === CylinderState.FILLED) {
        await tx.vendorCylinderReturnBalance.upsert({
          where: { vendorId_itemId: { vendorId: input.vendorId, itemId: line.itemId } },
          update: { emptyDue: { increment: line.quantity } },
          create: { vendorId: input.vendorId, itemId: line.itemId, emptyDue: line.quantity },
        });
      }

      if (line.emptyReturnQuantity > 0) {
        const emptyReturnEntry = await createStockLedgerEntry(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          itemId: line.itemId,
          cylinderState: CylinderState.EMPTY,
          direction: StockDirection.OUT,
          sourceType: StockSourceType.PURCHASE_FILLED,
          sourceId: input.issueNo,
          transactionDate: input.transactionDate,
          quantity: line.emptyReturnQuantity,
          createdById: input.userId,
          partyType: PartyType.VENDOR,
          vendorId: input.vendorId,
          remarks: "Empty cylinders returned to vendor with purchase receipt.",
          locationId: input.locationId,
        });
        stockEntries.push(emptyReturnEntry);
        await tx.vendorCylinderReturnBalance.update({
          where: { vendorId_itemId: { vendorId: input.vendorId, itemId: line.itemId } },
          data: { emptyDue: { decrement: line.emptyReturnQuantity } },
        });
      }
    }

    const stockCredit = discountAmount.gt(0) && !purchaseDiscountAccountId ? grossAmount.minus(discountAmount) : grossAmount;
    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.issueNo,
      voucherType: VoucherType.JV,
      voucherDate: input.transactionDate,
      narration: input.remarks,
      sourceType: "PurchaseFilledCylinder",
      sourceId: input.issueNo,
      createdById: input.userId,
      lines: [
        { accountId: stockAccountId, debit: stockCredit },
        ...(gstAmount.gt(0) ? [{ accountId: gstReceivableAccountId, debit: gstAmount }] : []),
        ...(discountAmount.gt(0) && purchaseDiscountAccountId ? [{ accountId: purchaseDiscountAccountId, credit: discountAmount }] : []),
        { accountId: vendor.accountId, credit: netPayableAmount },
      ],
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "PurchaseFilledCylinder",
      entityId: input.issueNo,
      after: {
        issueNo: input.issueNo,
        vendorId: input.vendorId,
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        elevenPointEightKgPrice: String(input.elevenPointEightKgPrice ?? ""),
        totalExGstAmount: String(grossAmount),
        totalGstAmount: String(gstAmount),
        totalIncGstAmount: String(payableAmount),
        discountAmount: String(discountAmount),
        netPayableAmount: String(netPayableAmount),
        amountPaid: String(input.amountPaid ?? 0),
        payMode: input.payMode ?? "Credit",
        lines: lines.map((line) => {
          const item = itemById.get(line.itemId);
          return {
            itemId: line.itemId,
            item: item ? [item.code, item.name].filter(Boolean).join(" - ") : line.itemId,
            cylinderState: line.cylinderState,
            quantity: line.quantity,
            unitCost: String(line.unitCost),
            gstPercent: String(line.gstPercent),
            gstAmount: String(line.gstAmount),
            emptyReturnQuantity: line.emptyReturnQuantity,
            exGstAmount: String(line.exGstAmount),
            incGstAmount: String(line.incGstAmount),
          };
        }),
      },
    });

    const amountPaid = decimal(input.amountPaid);
    const payMode = String(input.payMode ?? "Credit");
    let paymentVoucher = null;
    if (amountPaid.gt(0)) {
      if (amountPaid.gt(netPayableAmount)) throw new Error("amountPaid cannot exceed net payable after discount.");
      if (payMode.toLowerCase() === "bank") {
        if (!input.bankId) throw new Error("bankId is required for bank payment.");
        const voucherNo = await nextDocumentNumberInTransaction(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          prefix: DOCUMENT_PREFIXES.bankPaymentVoucher,
        });
        const bankAccountId = await getBankAccountId(tx, input.bankId);
        const narration = input.chequeNo ? `Cheque ${input.chequeNo}` : undefined;
        paymentVoucher = await createBalancedVoucher(tx, {
            companyId: input.companyId,
            financialYearId: input.financialYearId,
            voucherNo,
            voucherType: VoucherType.BP,
            voucherDate: input.transactionDate,
            narration,
            sourceType: "BankPayment",
            sourceId: voucherNo,
            createdById: input.userId,
            lines: [
              { accountId: vendor.accountId, debit: amountPaid },
              { accountId: bankAccountId, credit: amountPaid },
            ],
          });
      } else {
        const voucherNo = await nextDocumentNumberInTransaction(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          prefix: DOCUMENT_PREFIXES.cashPaymentVoucher,
        });
        const cashAccountId = await getCashAccountId(tx, input.companyId);
        paymentVoucher = await createBalancedVoucher(tx, {
            companyId: input.companyId,
            financialYearId: input.financialYearId,
            voucherNo,
            voucherType: VoucherType.CP,
            voucherDate: input.transactionDate,
            sourceType: "CashPayment",
            sourceId: voucherNo,
            createdById: input.userId,
            lines: [
              { accountId: vendor.accountId, debit: amountPaid },
              { accountId: cashAccountId, credit: amountPaid },
            ],
          });
      }
    }

    return {
      issueNo: input.issueNo,
      voucher,
      paymentVoucher,
      stockEntries,
      totalExGstAmount: grossAmount,
      totalGstAmount: gstAmount,
      totalIncGstAmount: payableAmount,
      discountAmount,
      netPayableAmount,
      amountPaid,
    };
  });
}
