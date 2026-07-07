import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode, getBankAccountId, getCashAccountId } from "../accounting/accounts.ts";
import { assertFilledStockAvailable } from "../inventory/stock-availability.ts";
import { createStockLedgerEntry, getWeightedAverageCost } from "../inventory/stock-ledger.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { createBalancedVoucher, type VoucherLineInput } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { assertCentralizedLinePrices } from "../pricing/kg-pricing.ts";

type SaleInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  issueNo: string;
  customerId: string;
  itemId?: string;
  quantity?: number;
  unitPrice?: string | number;
  securityDepositAmount?: string | number;
  saleType?: "Direct" | string;
  remarks?: string;
  elevenPointEightKgPrice?: string | number;
  invoiceLanguage?: "English" | "Urdu" | string;
  lines?: SaleLpgLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
  discount?: string | number;
  amountReceived?: string | number;
  receiveMode?: "Credit" | "Cash" | "Bank" | string;
  bankId?: string;
  chequeNo?: string;
  chequeDate?: string | Date;
  returnGasKg?: string | number;
  gasReturnRate?: string | number;
  locationId?: string;
};

type SaleLpgLineInput = {
  itemId: string;
  quantity: number;
  unitPrice: string | number;
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
  paymentType?: "Cash" | "Credit" | "Bank" | string;
  amountReceived?: string | number;
  receiveMode?: string;
  bankId?: string;
  chequeNo?: string;
};

function batchReceiveMode(sale: BatchSaleRowInput) {
  if (sale.receiveMode) return sale.receiveMode;
  const payment = String(sale.paymentType ?? "Credit").toLowerCase();
  if (payment === "cash") return "Cash";
  if (payment === "bank") return "Bank";
  return "Credit";
}

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
          securityDepositAmount: input.securityDepositAmount,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const unitPrice = decimal(line.unitPrice);
    if (unitPrice.lte(0)) throw new Error(`lines[${index}].unitPrice must be a positive number.`);
    const amount = unitPrice.times(quantity);
    const securityDepositAmount = decimal(line.securityDepositAmount);
    const receivableAmount = amount.plus(securityDepositAmount);
    const emptyReturnQuantity = Number(line.emptyReturnQuantity ?? 0);
    if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`lines[${index}].emptyReturnQuantity must be a non-negative integer.`);
    return {
      itemId: line.itemId,
      quantity,
      unitPrice,
      securityDepositAmount,
      amount,
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

async function createBankReceiptInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    financialYearId: string;
    userId: string;
    receiptNo: string;
    customerId: string;
    bankId: string;
    amount: Prisma.Decimal;
    transactionDate: string | Date;
    chequeNo?: string;
    allowClosedDayOverride?: boolean;
  },
) {
  await enforcePermission(tx, input.userId, "bank-receipts", PermissionAction.CREATE);
  await assertWritableBusinessDate(tx, input);

  const bankAccountId = await getBankAccountId(tx, input.bankId);
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
  const narration = input.chequeNo ? `Cheque ${input.chequeNo}` : undefined;
  const voucher = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo: input.receiptNo,
    voucherType: VoucherType.BR,
    voucherDate: input.transactionDate,
    narration,
    sourceType: "BankReceipt",
    sourceId: input.receiptNo,
    createdById: input.userId,
    lines: [
      { accountId: bankAccountId, debit: input.amount },
      { accountId: customer.accountId, credit: input.amount },
    ],
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "BankReceipt",
    entityId: input.receiptNo,
    after: { ...input, amount: String(input.amount) },
  });

  return { voucher };
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

  const company = await tx.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { stockAvailableCheck: true },
  });
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
  const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
  const securityLiabilityAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.securityLiability);
  let discountAccountId: string | null = null;
  try {
    discountAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.salesDiscount);
  } catch {
    discountAccountId = null;
  }
  const lines = normalizeLines(input);
  await assertCentralizedLinePrices(tx, {
    companyId: input.companyId,
    customerId: input.customerId,
    transactionDate: input.transactionDate,
    lines: lines.map((line) => ({ itemId: line.itemId, unitAmount: line.unitPrice })),
    amountLabel: "unit price",
  });
  const itemRows = await tx.item.findMany({
    where: { companyId: input.companyId, id: { in: [...new Set(lines.flatMap((line) => [line.itemId, line.emptyReturnItemId]))] } },
    select: { id: true, code: true, name: true },
  });
  const itemById = new Map(itemRows.map((item) => [item.id, item]));

  const saleAmount = lines.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
  const securityAmount = lines.reduce((sum, line) => sum.plus(line.securityDepositAmount), new Prisma.Decimal(0));
  const receivableAmount = saleAmount.plus(securityAmount);
  const discountRaw = decimal(input.discount);
  const discountAmount = discountRaw.gt(receivableAmount) ? receivableAmount : discountRaw;
  const netReceivableAmount = receivableAmount.minus(discountAmount);
  const stockEntries = [];

  if (company.stockAvailableCheck) {
    await assertFilledStockAvailable(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      locationId: input.locationId,
      lines: lines.map((line) => {
        const item = itemById.get(line.itemId);
        return {
          itemId: line.itemId,
          quantity: line.quantity,
          itemLabel: item ? [item.code, item.name].filter(Boolean).join(" - ") : line.itemId,
        };
      }),
    });
  }

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
      locationId: input.locationId,
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
        locationId: input.locationId,
      });
      stockEntries.push(emptyReturnEntry);
      await decrementCustomerEmptyOwed(tx, input.customerId, line.emptyReturnItemId, line.emptyReturnQuantity);
    }
  }

  // COGS: weighted-average cost for FILLED cylinders sold
  const cogsAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.cogs);
  const stockAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.stock);
  const uniqueItems = new Map<string, { itemId: string; qty: number; locationId?: string | null }>();
  for (const line of lines) {
    const key = `${line.itemId}::${input.locationId ?? ""}`;
    const existing = uniqueItems.get(key);
    if (existing) {
      existing.qty += line.quantity;
    } else {
      uniqueItems.set(key, { itemId: line.itemId, qty: line.quantity, locationId: input.locationId });
    }
  }
  const cogsLines: VoucherLineInput[] = [];
  for (const entry of uniqueItems.values()) {
    const avgCost = await getWeightedAverageCost(tx, input.companyId, entry.itemId, CylinderState.FILLED, entry.locationId);
    if (avgCost.gt(0) && entry.qty > 0) {
      const totalCost = avgCost.times(entry.qty);
      cogsLines.push({ accountId: cogsAccountId, debit: totalCost });
      cogsLines.push({ accountId: stockAccountId, credit: totalCost });
    }
  }

  const salesCredit = discountAmount.gt(0) && !discountAccountId ? saleAmount.minus(discountAmount) : saleAmount;
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
      { accountId: customer.accountId, debit: netReceivableAmount },
      ...(discountAmount.gt(0) && discountAccountId ? [{ accountId: discountAccountId, debit: discountAmount }] : []),
      { accountId: salesAccountId, credit: salesCredit },
      ...(securityAmount.gt(0) ? [{ accountId: securityLiabilityAccountId, credit: securityAmount }] : []),
      ...cogsLines,
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
      totalAmount: String(saleAmount),
      totalSecurityAmount: String(securityAmount),
      totalReceivableAmount: String(receivableAmount),
      discountAmount: String(discountAmount),
      netReceivableAmount: String(netReceivableAmount),
      amountReceived: String(input.amountReceived ?? 0),
      receiveMode: input.receiveMode ?? "Credit",
      returnGasKg: String(input.returnGasKg ?? ""),
      gasReturnRate: String(input.gasReturnRate ?? ""),
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
          securityDepositAmount: String(line.securityDepositAmount),
          emptyReturnItemId: line.emptyReturnItemId,
          emptyReturnItem: returnItem ? [returnItem.code, returnItem.name].filter(Boolean).join(" - ") : line.emptyReturnItemId,
          emptyReturnQuantity: line.emptyReturnQuantity,
          amount: String(line.amount),
        };
      }),
    },
  });

  const amountReceived = decimal(input.amountReceived);
  const receiveMode = String(input.receiveMode ?? "Credit");
  let receiptVoucher = null;
  if (amountReceived.gt(0)) {
    if (amountReceived.gt(netReceivableAmount)) {
      throw new Error("amountReceived cannot exceed net bill after discount.");
    }
    if (receiveMode.toLowerCase() === "bank") {
      if (!input.bankId) throw new Error("bankId is required for bank receipt.");
      const receiptNo = await nextDocumentNumberInTransaction(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        prefix: DOCUMENT_PREFIXES.bankReceiptVoucher,
      });
      receiptVoucher = (
        await createBankReceiptInTransaction(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          userId: input.userId,
          receiptNo,
          customerId: input.customerId,
          bankId: input.bankId,
          amount: amountReceived,
          transactionDate: input.transactionDate,
          chequeNo: input.chequeNo,
          allowClosedDayOverride: input.allowClosedDayOverride,
        })
      ).voucher;
    } else {
      const receiptNo = await nextDocumentNumberInTransaction(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        prefix: DOCUMENT_PREFIXES.cashReceiptVoucher,
      });
      receiptVoucher = (
        await createCashReceiptInTransaction(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          userId: input.userId,
          receiptNo,
          customerId: input.customerId,
          amount: amountReceived,
          transactionDate: input.transactionDate,
          allowClosedDayOverride: input.allowClosedDayOverride,
        })
      ).voucher;
    }
  }

  return {
    issueNo: input.issueNo,
    voucher,
    receiptVoucher,
    stockEntries,
    totalAmount: saleAmount,
    totalSecurityAmount: securityAmount,
    totalReceivableAmount: receivableAmount,
    discountAmount,
    netReceivableAmount,
    amountReceived,
  };
}

function legacyItemLabel(itemField: string) {
  const separator = itemField.indexOf(" - ");
  if (separator > 0) return `${itemField.slice(0, separator)}-${itemField.slice(separator + 3)}`;
  return itemField;
}

function formatSaleItemsSummary(lines: unknown) {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  return lines
    .map((line) => {
      const row = line as Record<string, unknown>;
      const label = legacyItemLabel(String(row.item ?? row.itemId ?? ""));
      const qty = Number(row.quantity ?? 0);
      const amount = row.amount ?? row.unitPrice ?? "0";
      return `${label} @ ${qty} : ${amount}`;
    })
    .join(", ");
}

export async function listSaleLpg(
  context: { companyId: string; financialYearId: string; userId: string },
  input: { from?: string; to?: string; limit?: number; offset?: number; search?: string },
) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "sale-lpg", PermissionAction.VIEW);
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;
    if (to) to.setUTCHours(23, 59, 59, 999);
    const pageSize = Math.min(Math.max(input.limit ?? 10, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const search = input.search?.trim().toLowerCase();

    const where = {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      sourceType: "SaleLpg" as const,
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
        narration: true,
        sourceId: true,
      },
    });

    const issueNos = vouchers.map((v) => v.sourceId ?? "").filter(Boolean);
    const logs = await tx.auditLog.findMany({
      where: { companyId: context.companyId, entityType: "SaleLpg", entityId: { in: issueNos } },
      select: { entityId: true, after: true },
    });
    const afterByIssue = new Map(logs.map((log) => [log.entityId, log.after as Record<string, unknown> | null]));
    const customerIds = [
      ...new Set(
        logs
          .map((log) => (afterByIssue.get(log.entityId)?.customerId as string | undefined) ?? "")
          .filter(Boolean),
      ),
    ];
    const customers = await tx.customer.findMany({
      where: { companyId: context.companyId, id: { in: customerIds } },
      select: { id: true, name: true, code: true },
    });
    const customerById = new Map(customers.map((row) => [row.id, row]));

    const rows = vouchers.map((voucher) => {
      const after = afterByIssue.get(voucher.sourceId ?? "") ?? {};
      const customerId = typeof after.customerId === "string" ? after.customerId : "";
      const customer = customerById.get(customerId);
      const issueNo = voucher.sourceId ?? voucher.voucherNo;
      const customerName = customer?.name ?? customerId;
      const itemsSummary = formatSaleItemsSummary(after.lines);
      return {
        issueNo,
        voucherId: voucher.id,
        transactionDate: voucher.voucherDate,
        customerName,
        customerCode: customer?.code ?? "",
        itemsSummary,
        totalAmount: String(after.totalAmount ?? after.totalReceivableAmount ?? voucher.totalDebit),
        totalReceivableAmount: String(after.totalReceivableAmount ?? voucher.totalDebit),
        netReceivableAmount: String(after.netReceivableAmount ?? voucher.totalDebit),
        amountReceived: String(after.amountReceived ?? "0"),
        lineCount: Array.isArray(after.lines) ? after.lines.length : 0,
      };
    });

    const filtered = search
      ? rows.filter((row) => {
          const haystack = [row.issueNo, row.customerName, row.customerCode, row.itemsSummary].join(" ").toLowerCase();
          return haystack.includes(search);
        })
      : rows;

    return {
      sales: filtered.slice(offset, offset + pageSize),
      total: filtered.length,
      limit: pageSize,
      offset,
    };
  });
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
    const auditRows = [];
    for (const sale of input.sales) {
      const issueNo = sale.issueNo ?? (await nextDocumentNumberInTransaction(tx, { companyId: input.companyId, financialYearId: input.financialYearId, prefix: DOCUMENT_PREFIXES.saleIssue }));
      issueNos.push(issueNo);
      const receiveMode = batchReceiveMode(sale);
      const amountReceived = decimal(sale.amountReceived);
      const saleResult = await createSaleInTransaction(tx, {
        ...sale,
        issueNo,
        lines: sale.lines ?? sale.items,
        transactionDate: sale.transactionDate ?? input.transactionDate ?? "",
        remarks: sale.remarks ?? input.remarks,
        saleType: sale.saleType ?? "Direct",
        receiveMode,
        amountReceived: amountReceived.gt(0) ? String(amountReceived) : undefined,
        bankId: sale.bankId,
        chequeNo: sale.chequeNo,
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        userId: input.userId,
        allowClosedDayOverride: input.allowClosedDayOverride,
      });
      sales.push(saleResult);

      auditRows.push({
        issueNo,
        customerId: sale.customerId,
        paymentType: sale.paymentType ?? "Credit",
        receiveMode,
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

    return { sales, issueNos };
  });
}
