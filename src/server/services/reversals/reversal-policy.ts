import {
  AuditAction,
  CylinderState,
  PartyType,
  PermissionAction,
  Prisma,
  StockDirection,
  StockSourceType,
  VoucherType,
  type AccountingVoucher,
  type AccountingVoucherLine,
  type Prisma as PrismaTypes,
  type StockLedgerEntry,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

export type ReversalKind = "sale" | "purchase" | "cash-receipt" | "cash-payment" | "bank-receipt" | "bank-payment" | "cylinder-return";

type Context = { companyId: string; financialYearId: string; userId: string };

type ReversalInput = {
  kind: ReversalKind;
  documentNo: string;
  reversalDate: string | Date;
  reversalNo?: string;
  reason?: string;
  allowClosedDayOverride?: boolean;
};

type ReversalConfig = {
  module: string;
  voucherSourceType?: string;
  stockSourceType?: StockSourceType;
  stockReverseDirection?: StockDirection;
  entityType: string;
};

const configs: Record<ReversalKind, ReversalConfig> = {
  sale: {
    module: "sale-lpg",
    voucherSourceType: "SaleLpg",
    stockSourceType: StockSourceType.SALE_LPG,
    stockReverseDirection: StockDirection.IN,
    entityType: "SaleLpgReversal",
  },
  purchase: {
    module: "purchase-filled-cylinders",
    voucherSourceType: "PurchaseFilledCylinder",
    stockSourceType: StockSourceType.PURCHASE_FILLED,
    stockReverseDirection: StockDirection.OUT,
    entityType: "PurchaseFilledCylinderReversal",
  },
  "cash-receipt": { module: "cash-receipts", voucherSourceType: "CashReceipt", entityType: "CashReceiptReversal" },
  "cash-payment": { module: "cash-payments", voucherSourceType: "CashPayment", entityType: "CashPaymentReversal" },
  "bank-receipt": { module: "bank-receipts", voucherSourceType: "BankReceipt", entityType: "BankReceiptReversal" },
  "bank-payment": { module: "bank-payments", voucherSourceType: "BankPayment", entityType: "BankPaymentReversal" },
  "cylinder-return": {
    module: "cylinder-returns",
    stockSourceType: StockSourceType.CYLINDER_RETURN,
    stockReverseDirection: StockDirection.OUT,
    entityType: "CylinderReturnReversal",
  },
};

const supportedKinds = new Set(Object.keys(configs));

function asDecimal(value: Prisma.Decimal | number | string | null | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function oppositeDirection(direction: StockDirection) {
  return direction === StockDirection.IN ? StockDirection.OUT : StockDirection.IN;
}

function assertSupported(kind: ReversalKind) {
  if (kind === ("payment" as ReversalKind)) {
    throw new Error("Unsupported payment reversal kind. Use cash-receipt, cash-payment, bank-receipt, or bank-payment.");
  }
  if (!supportedKinds.has(kind)) {
    throw new Error("Unsupported reversal type.");
  }
  const config = configs[kind];
  if (!config) throw new Error("Unsupported reversal type.");
  return config;
}

async function ensureNotReversed(tx: PrismaTypes.TransactionClient, context: Context, documentNo: string, kind: ReversalKind) {
  const existing = await tx.auditLog.findFirst({
    where: {
      companyId: context.companyId,
      entityType: configs[kind].entityType,
      entityId: documentNo,
    },
    select: { id: true },
  });
  if (existing) throw new Error("This document has already been reversed.");
}

async function findOriginalVoucher(tx: PrismaTypes.TransactionClient, context: Context, config: ReversalConfig, documentNo: string) {
  if (!config.voucherSourceType) return null;
  return tx.accountingVoucher.findFirst({
    where: {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      sourceType: config.voucherSourceType,
      sourceId: documentNo,
    },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
}

async function findOriginalStockEntry(tx: PrismaTypes.TransactionClient, context: Context, config: ReversalConfig, documentNo: string) {
  if (!config.stockSourceType) return null;
  return tx.stockLedgerEntry.findFirst({
    where: {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      sourceType: config.stockSourceType,
      sourceId: documentNo,
    },
    orderBy: { createdAt: "asc" },
  });
}

function reversedLines(lines: AccountingVoucherLine[]) {
  return lines.map((line) => ({
    accountId: line.accountId,
    description: `Reversal of ${line.description ?? "original line"}`,
    debit: line.credit,
    credit: line.debit,
  }));
}

async function createReversalVoucher(
  tx: PrismaTypes.TransactionClient,
  context: Context,
  input: ReversalInput,
  reversalNo: string,
  originalVoucher: AccountingVoucher & { lines: AccountingVoucherLine[] },
) {
  return createBalancedVoucher(tx, {
    companyId: context.companyId,
    financialYearId: context.financialYearId,
    voucherNo: reversalNo,
    voucherType: VoucherType.JV,
    voucherDate: input.reversalDate,
    narration: `Reversal of ${input.documentNo}${input.reason ? `: ${input.reason}` : ""}`,
    sourceType: "Reversal",
    sourceId: input.documentNo,
    createdById: context.userId,
    lines: reversedLines(originalVoucher.lines),
  });
}

async function createReversalStockEntry(
  tx: PrismaTypes.TransactionClient,
  context: Context,
  input: ReversalInput,
  reversalNo: string,
  originalStockEntry: StockLedgerEntry,
  direction: StockDirection,
) {
  return createStockLedgerEntry(tx, {
    companyId: context.companyId,
    financialYearId: context.financialYearId,
    itemId: originalStockEntry.itemId,
    cylinderState: originalStockEntry.cylinderState,
    direction,
    sourceType: StockSourceType.ADJUSTMENT,
    sourceId: reversalNo,
    transactionDate: input.reversalDate,
    quantity: originalStockEntry.quantity,
    createdById: context.userId,
    partyType: originalStockEntry.partyType ?? undefined,
    customerId: originalStockEntry.customerId ?? undefined,
    vendorId: originalStockEntry.vendorId ?? undefined,
    remarks: `Reversal of ${input.kind} ${input.documentNo}`,
  });
}

async function reverseCylinderBalances(
  tx: PrismaTypes.TransactionClient,
  kind: ReversalKind,
  originalStockEntry: StockLedgerEntry | null,
  originalVoucher: (AccountingVoucher & { lines: AccountingVoucherLine[] }) | null,
) {
  if (kind === "sale") {
    if (!originalStockEntry?.customerId) throw new Error("Original sale stock entry is missing customer reference.");
    const audit = await tx.auditLog.findFirst({
      where: { entityType: "SaleLpg", entityId: originalStockEntry.sourceId },
      orderBy: { createdAt: "desc" },
    });
    const after = audit?.after && typeof audit.after === "object" && !Array.isArray(audit.after) ? (audit.after as Record<string, unknown>) : {};
    const securityAmount = asDecimal(after.securityDepositAmount as string | number | undefined);
    const balance = await tx.customerCylinderBalance.findUnique({
      where: { customerId_itemId: { customerId: originalStockEntry.customerId, itemId: originalStockEntry.itemId } },
      select: { emptyOwed: true, securityHeld: true },
    });
    if (!balance || balance.emptyOwed < originalStockEntry.quantity || asDecimal(balance.securityHeld).lt(securityAmount)) {
      throw new Error("Customer cylinder balance cannot support this sale reversal.");
    }
    await tx.customerCylinderBalance.update({
      where: { customerId_itemId: { customerId: originalStockEntry.customerId, itemId: originalStockEntry.itemId } },
      data: {
        emptyOwed: { decrement: originalStockEntry.quantity },
        securityHeld: { decrement: securityAmount },
      },
    });
    return;
  }

  if (kind === "purchase") {
    if (!originalStockEntry?.vendorId) throw new Error("Original purchase stock entry is missing vendor reference.");
    const balance = await tx.vendorCylinderReturnBalance.findUnique({
      where: { vendorId_itemId: { vendorId: originalStockEntry.vendorId, itemId: originalStockEntry.itemId } },
      select: { emptyDue: true },
    });
    if (!balance || balance.emptyDue < originalStockEntry.quantity) {
      throw new Error("Vendor cylinder return balance cannot support this purchase reversal.");
    }
    await tx.vendorCylinderReturnBalance.update({
      where: { vendorId_itemId: { vendorId: originalStockEntry.vendorId, itemId: originalStockEntry.itemId } },
      data: { emptyDue: { decrement: originalStockEntry.quantity } },
    });
    return;
  }

  if (kind === "cylinder-return") {
    if (!originalStockEntry?.customerId) throw new Error("Original return stock entry is missing customer reference.");
    await tx.customerCylinderBalance.upsert({
      where: { customerId_itemId: { customerId: originalStockEntry.customerId, itemId: originalStockEntry.itemId } },
      update: { emptyOwed: { increment: originalStockEntry.quantity } },
      create: { customerId: originalStockEntry.customerId, itemId: originalStockEntry.itemId, emptyOwed: originalStockEntry.quantity },
    });
    return;
  }

  if (originalVoucher && kind.startsWith("bank")) return;
}

export async function assertReversalPolicy(context: Context, input: Pick<ReversalInput, "kind" | "documentNo" | "reversalDate" | "allowClosedDayOverride">) {
  const config = assertSupported(input.kind);
  if (!input.documentNo?.trim()) throw new Error("documentNo is required.");

  await prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, config.module, PermissionAction.APPROVE);
    await assertWritableBusinessDate(tx, {
      ...context,
      transactionDate: input.reversalDate,
      allowClosedDayOverride: input.allowClosedDayOverride,
    });
  });
}

export async function createCompensatingReversal(context: Context, input: ReversalInput) {
  const config = assertSupported(input.kind);
  if (!input.documentNo?.trim()) throw new Error("documentNo is required.");

  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, config.module, PermissionAction.APPROVE);
    await assertWritableBusinessDate(tx, {
      ...context,
      transactionDate: input.reversalDate,
      allowClosedDayOverride: input.allowClosedDayOverride,
    });
    await ensureNotReversed(tx, context, input.documentNo, input.kind);

    const originalVoucher = await findOriginalVoucher(tx, context, config, input.documentNo);
    const originalStockEntry = await findOriginalStockEntry(tx, context, config, input.documentNo);
    if (config.voucherSourceType && !originalVoucher) throw new Error("Original voucher was not found.");
    if (config.stockSourceType && !originalStockEntry) throw new Error("Original stock ledger entry was not found.");

    const reversalNo =
      input.reversalNo ??
      (await nextDocumentNumberInTransaction(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        prefix: "RV",
      }));

    const voucher = originalVoucher ? await createReversalVoucher(tx, context, input, reversalNo, originalVoucher) : null;
    const stockEntry =
      originalStockEntry && config.stockReverseDirection
        ? await createReversalStockEntry(tx, context, input, reversalNo, originalStockEntry, config.stockReverseDirection)
        : null;

    await reverseCylinderBalances(tx, input.kind, originalStockEntry, originalVoucher);

    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.CREATE,
      entityType: config.entityType,
      entityId: input.documentNo,
      after: {
        reversalNo,
        originalDocumentNo: input.documentNo,
        kind: input.kind,
        reason: input.reason,
        voucherId: voucher?.id,
        stockLedgerEntryId: stockEntry?.id,
      },
    });

    return { reversalNo, voucher, stockEntries: stockEntry ? [stockEntry] : [] };
  });
}

export async function createReversalStub(context: Context, input: ReversalInput) {
  return createCompensatingReversal(context, input);
}

export function deletionIsNeverAReversal() {
  throw new Error("Unsafe delete is not a valid reversal. Use compensating reversal entries.");
}
