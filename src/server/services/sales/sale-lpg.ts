import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode, getCashAccountId } from "../accounting/accounts.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type SaleInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  issueNo: string;
  customerId: string;
  itemId?: string;
  quantity?: number;
  unitPrice?: string | number;
  gstAmount?: string | number;
  gstPercent?: string | number;
  securityDepositAmount?: string | number;
  saleType?: "Direct" | string;
  remarks?: string;
  elevenPointEightKgPrice?: string | number;
  invoiceLanguage?: "English" | "Urdu" | string;
  lines?: SaleLpgLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

type SaleLpgLineInput = {
  itemId: string;
  quantity: number;
  unitPrice: string | number;
  gstPercent?: string | number;
  gstAmount?: string | number;
  securityDepositAmount?: string | number;
  emptyReturnItemId?: string;
  emptyReturnQuantity?: number;
};

type BatchInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  batchNo: string;
  transactionDate?: string | Date;
  remarks?: string;
  sales: BatchSaleRowInput[];
  allowClosedDayOverride?: boolean;
};

type BatchSaleRowInput = Omit<SaleInput, "companyId" | "financialYearId" | "userId" | "issueNo" | "transactionDate"> & {
  issueNo?: string;
  transactionDate?: string | Date;
  items?: SaleLpgLineInput[];
  paymentType?: "Cash" | "Credit" | string;
  amountReceived?: string | number;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function normalizeLines(input: SaleInput) {
  const rawLines: SaleLpgLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          itemId: input.itemId ?? "",
          quantity: input.quantity ?? 0,
          unitPrice: input.unitPrice ?? 0,
          gstAmount: input.gstAmount,
          gstPercent: input.gstPercent,
          securityDepositAmount: input.securityDepositAmount,
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
    const securityDepositAmount = decimal(line.securityDepositAmount);
    const incGstAmount = exGstAmount.plus(gstAmount);
    const receivableAmount = incGstAmount.plus(securityDepositAmount);
    const emptyReturnQuantity = Number(line.emptyReturnQuantity ?? 0);
    if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`lines[${index}].emptyReturnQuantity must be a non-negative integer.`);
    return {
      itemId: line.itemId,
      quantity,
      unitPrice,
      gstPercent,
      gstAmount,
      securityDepositAmount,
      exGstAmount,
      incGstAmount,
      receivableAmount,
      emptyReturnItemId: line.emptyReturnItemId || line.itemId,
      emptyReturnQuantity,
    };
  });
}

async function decrementCustomerEmptyOwed(tx: Prisma.TransactionClient, customerId: string, itemId: string, quantity: number) {
  if (quantity <= 0) return;
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

async function createCashReceiptInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    financialYearId: string;
    userId: string;
    receiptNo: string;
    customerId: string;
    amount: Prisma.Decimal;
    transactionDate: string | Date;
    allowClosedDayOverride?: boolean;
  },
) {
  await enforcePermission(tx, input.userId, "cash-receipts", PermissionAction.CREATE);
  await assertWritableBusinessDate(tx, input);

  const cashAccountId = await getCashAccountId(tx, input.companyId);
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
  const voucher = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo: input.receiptNo,
    voucherType: VoucherType.CR,
    voucherDate: input.transactionDate,
    sourceType: "CashReceipt",
    sourceId: input.receiptNo,
    createdById: input.userId,
    lines: [
      { accountId: cashAccountId, debit: input.amount },
      { accountId: customer.accountId, credit: input.amount },
    ],
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "CashReceipt",
    entityId: input.receiptNo,
    after: { ...input, amount: String(input.amount) },
  });

  return { voucher };
}

async function createSaleInTransaction(tx: Prisma.TransactionClient, input: SaleInput) {
  await assertWritableBusinessDate(tx, input);

  const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
  const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
  const gstPayableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstPayable);
  const securityLiabilityAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.securityLiability);
  const lines = normalizeLines(input);
  const itemRows = await tx.item.findMany({
    where: { companyId: input.companyId, id: { in: [...new Set(lines.flatMap((line) => [line.itemId, line.emptyReturnItemId]))] } },
    select: { id: true, code: true, name: true },
  });
  const itemById = new Map(itemRows.map((item) => [item.id, item]));

  const saleAmount = lines.reduce((sum, line) => sum.plus(line.exGstAmount), new Prisma.Decimal(0));
  const gstAmount = lines.reduce((sum, line) => sum.plus(line.gstAmount), new Prisma.Decimal(0));
  const securityAmount = lines.reduce((sum, line) => sum.plus(line.securityDepositAmount), new Prisma.Decimal(0));
  const receivableAmount = saleAmount.plus(gstAmount).plus(securityAmount);
  const stockEntries = [];

  for (const line of lines) {
    const stockEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.SALE_LPG,
      sourceId: input.issueNo,
      transactionDate: input.transactionDate,
      quantity: line.quantity,
      createdById: input.userId,
      partyType: PartyType.CUSTOMER,
      customerId: input.customerId,
    });
    stockEntries.push(stockEntry);

    await tx.customerCylinderBalance.upsert({
      where: { customerId_itemId: { customerId: input.customerId, itemId: line.itemId } },
      update: {
        emptyOwed: { increment: line.quantity },
        securityHeld: { increment: line.securityDepositAmount },
      },
      create: {
        customerId: input.customerId,
        itemId: line.itemId,
        emptyOwed: line.quantity,
        securityHeld: line.securityDepositAmount,
      },
    });

    if (line.emptyReturnQuantity > 0) {
      const emptyReturnEntry = await createStockLedgerEntry(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        itemId: line.emptyReturnItemId,
        cylinderState: CylinderState.EMPTY,
        direction: StockDirection.IN,
        sourceType: StockSourceType.SALE_LPG,
        sourceId: input.issueNo,
        transactionDate: input.transactionDate,
        quantity: line.emptyReturnQuantity,
        createdById: input.userId,
        partyType: PartyType.CUSTOMER,
        customerId: input.customerId,
        remarks: "Empty cylinders returned by customer with sale invoice.",
      });
      stockEntries.push(emptyReturnEntry);
      await decrementCustomerEmptyOwed(tx, input.customerId, line.emptyReturnItemId, line.emptyReturnQuantity);
    }
  }

  const voucher = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo: input.issueNo,
    voucherType: VoucherType.SR,
    voucherDate: input.transactionDate,
    narration: input.remarks,
    sourceType: "SaleLpg",
    sourceId: input.issueNo,
    createdById: input.userId,
    lines: [
      { accountId: customer.accountId, debit: receivableAmount },
      { accountId: salesAccountId, credit: saleAmount },
      ...(gstAmount.gt(0) ? [{ accountId: gstPayableAccountId, credit: gstAmount }] : []),
      ...(securityAmount.gt(0) ? [{ accountId: securityLiabilityAccountId, credit: securityAmount }] : []),
    ],
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "SaleLpg",
    entityId: input.issueNo,
    after: {
      issueNo: input.issueNo,
      customerId: input.customerId,
      transactionDate: input.transactionDate,
      saleType: input.saleType ?? "Direct",
      remarks: input.remarks,
      elevenPointEightKgPrice: String(input.elevenPointEightKgPrice ?? ""),
      invoiceLanguage: input.invoiceLanguage ?? "English",
      totalExGstAmount: String(saleAmount),
      totalGstAmount: String(gstAmount),
      totalSecurityAmount: String(securityAmount),
      totalReceivableAmount: String(receivableAmount),
      lines: lines.map((line) => {
        const item = itemById.get(line.itemId);
        const returnItem = itemById.get(line.emptyReturnItemId);
        return {
          itemId: line.itemId,
          item: item ? [item.code, item.name].filter(Boolean).join(" - ") : line.itemId,
          cylinderState: CylinderState.FILLED,
          direction: StockDirection.OUT,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          gstPercent: String(line.gstPercent),
          gstAmount: String(line.gstAmount),
          securityDepositAmount: String(line.securityDepositAmount),
          emptyReturnItemId: line.emptyReturnItemId,
          emptyReturnItem: returnItem ? [returnItem.code, returnItem.name].filter(Boolean).join(" - ") : line.emptyReturnItemId,
          emptyReturnQuantity: line.emptyReturnQuantity,
          exGstAmount: String(line.exGstAmount),
          incGstAmount: String(line.incGstAmount),
        };
      }),
    },
  });

  return {
    issueNo: input.issueNo,
    voucher,
    stockEntries,
    totalExGstAmount: saleAmount,
    totalGstAmount: gstAmount,
    totalSecurityAmount: securityAmount,
    totalReceivableAmount: receivableAmount,
  };
}

export async function saleLpgSingle(input: SaleInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "sale-lpg", PermissionAction.CREATE);
    return createSaleInTransaction(tx, input);
  });
}

export async function saleLpgCompleteDayBatch(input: BatchInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "sale-lpg", PermissionAction.CREATE);

    const sales = [];
    const issueNos = [];
    const cashReceipts = [];
    const auditRows = [];
    for (const sale of input.sales) {
      const issueNo = sale.issueNo ?? (await nextDocumentNumberInTransaction(tx, { companyId: input.companyId, financialYearId: input.financialYearId, prefix: DOCUMENT_PREFIXES.saleIssue }));
      issueNos.push(issueNo);
      const saleResult = await createSaleInTransaction(tx, {
        ...sale,
        issueNo,
        lines: sale.lines ?? sale.items,
        transactionDate: sale.transactionDate ?? input.transactionDate ?? "",
        remarks: sale.remarks ?? input.remarks,
        saleType: sale.saleType ?? "Direct",
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        userId: input.userId,
        allowClosedDayOverride: input.allowClosedDayOverride,
      });
      sales.push(saleResult);

      const amountReceived = decimal(sale.amountReceived);
      if (String(sale.paymentType ?? "").toLowerCase() === "cash" && amountReceived.gt(0)) {
        const receiptNo = await nextDocumentNumberInTransaction(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          prefix: DOCUMENT_PREFIXES.cashReceiptVoucher,
        });
        cashReceipts.push(
          await createCashReceiptInTransaction(tx, {
            companyId: input.companyId,
            financialYearId: input.financialYearId,
            userId: input.userId,
            receiptNo,
            customerId: sale.customerId,
            amount: amountReceived,
            transactionDate: sale.transactionDate ?? input.transactionDate ?? "",
            allowClosedDayOverride: input.allowClosedDayOverride,
          }),
        );
      }

      auditRows.push({
        issueNo,
        customerId: sale.customerId,
        paymentType: sale.paymentType ?? "Credit",
        amountReceived: String(amountReceived),
        totalReceivableAmount: String(saleResult.totalReceivableAmount),
        lineCount: (sale.lines ?? sale.items ?? []).length,
      });
    }

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "CompleteDaySaleBatch",
      entityId: input.batchNo,
      after: { batchNo: input.batchNo, transactionDate: input.transactionDate, remarks: input.remarks, count: input.sales.length, rows: auditRows },
    });

    return { sales, issueNos, cashReceipts };
  });
}
