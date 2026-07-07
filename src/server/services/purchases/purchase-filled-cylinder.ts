import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { postVendorSettlement } from "../accounting/settlement-vouchers.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { assertCentralizedLinePrices } from "../pricing/kg-pricing.ts";

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
  bankAmount?: string | number;
  cashAmount?: string | number;
  payMode?: "Credit" | "Cash" | "Bank" | "Split" | string;
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
    const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
    const gstReceivableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstReceivable);
    const lines = normalizeLines(input);
    await assertCentralizedLinePrices(tx, {
      companyId: input.companyId,
      transactionDate: input.transactionDate,
      lines: lines.map((line) => ({ itemId: line.itemId, unitAmount: line.unitCost })),
      amountLabel: "unit cost",
    });
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
        bankAmount: String(input.bankAmount ?? 0),
        cashAmount: String(input.cashAmount ?? 0),
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

    return {
      issueNo: input.issueNo,
      voucher,
      paymentVoucher,
      bankPaymentVoucher: settlement.bankPaymentVoucher,
      cashPaymentVoucher: settlement.cashPaymentVoucher,
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

function legacyItemLabel(itemField: string) {
  const separator = itemField.indexOf(" - ");
  if (separator > 0) return `${itemField.slice(0, separator)}-${itemField.slice(separator + 3)}`;
  return itemField;
}

function formatPurchaseItemsSummary(lines: unknown) {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  return lines
    .map((line) => {
      const row = line as Record<string, unknown>;
      const label = legacyItemLabel(String(row.item ?? row.itemId ?? ""));
      const qty = Number(row.quantity ?? 0);
      const amount = row.incGstAmount ?? row.exGstAmount ?? row.unitCost ?? "0";
      return `${label} @ ${qty} : ${amount}`;
    })
    .join(", ");
}

export async function listPurchaseFilledCylinder(
  context: { companyId: string; financialYearId: string; userId: string },
  input: { from?: string; to?: string; limit?: number; offset?: number; search?: string },
) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "purchase-filled-cylinders", PermissionAction.VIEW);
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;
    if (to) to.setUTCHours(23, 59, 59, 999);
    const pageSize = Math.min(Math.max(input.limit ?? 10, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const search = input.search?.trim().toLowerCase();

    const where = {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      sourceType: "PurchaseFilledCylinder" as const,
      ...(from || to
        ? {
            voucherDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const vouchers = await tx.accountingVoucher.findMany({
      where,
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        voucherNo: true,
        voucherDate: true,
        totalDebit: true,
        sourceId: true,
      },
    });

    const receiptNos = vouchers.map((v) => v.sourceId ?? "").filter(Boolean);
    const logs = await tx.auditLog.findMany({
      where: { companyId: context.companyId, entityType: "PurchaseFilledCylinder", entityId: { in: receiptNos } },
      select: { entityId: true, after: true },
    });
    const afterByReceipt = new Map(logs.map((log) => [log.entityId, log.after as Record<string, unknown> | null]));
    const vendorIds = [
      ...new Set(
        logs
          .map((log) => (afterByReceipt.get(log.entityId)?.vendorId as string | undefined) ?? "")
          .filter(Boolean),
      ),
    ];
    const vendors = await tx.vendor.findMany({
      where: { companyId: context.companyId, id: { in: vendorIds } },
      select: { id: true, name: true, code: true },
    });
    const vendorById = new Map(vendors.map((row) => [row.id, row]));

    const rows = vouchers.map((voucher) => {
      const after = afterByReceipt.get(voucher.sourceId ?? "") ?? {};
      const vendorId = typeof after.vendorId === "string" ? after.vendorId : "";
      const vendor = vendorById.get(vendorId);
      const receiptNo = voucher.sourceId ?? voucher.voucherNo;
      return {
        receiptNo,
        voucherId: voucher.id,
        transactionDate: voucher.voucherDate,
        vendorCode: vendor?.code ?? "",
        vendorName: vendor?.name ?? vendorId,
        itemsSummary: formatPurchaseItemsSummary(after.lines),
        totalAmount: String(after.totalIncGstAmount ?? after.netPayableAmount ?? voucher.totalDebit),
        netPayableAmount: String(after.netPayableAmount ?? voucher.totalDebit),
        amountPaid: String(after.amountPaid ?? "0"),
      };
    });

    const filtered = search
      ? rows.filter((row) => {
          const haystack = [row.receiptNo, row.vendorCode, row.vendorName, row.itemsSummary].join(" ").toLowerCase();
          return haystack.includes(search);
        })
      : rows;

    return {
      purchases: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      limit: pageSize,
      offset,
    };
  });
}
