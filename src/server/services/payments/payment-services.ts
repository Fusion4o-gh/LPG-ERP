import { PermissionAction, Prisma, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { getBankAccountId, getCashAccountId, getAccountIdByCode, ACCOUNT_CODES } from "../accounting/accounts.ts";
import { assertPostingAccountsAllowed, type PostingRuleKey } from "../accounting/posting-rules.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type BasePaymentInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  receiptNo?: string;
  voucherNo?: string;
  customerId?: string;
  vendorId?: string;
  bankId?: string;
  amount: string | number;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

async function customerAccount(tx: Prisma.TransactionClient, customerId: string) {
  return (await tx.customer.findUniqueOrThrow({ where: { id: customerId }, select: { accountId: true } })).accountId;
}

async function vendorAccount(tx: Prisma.TransactionClient, vendorId: string) {
  return (await tx.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { accountId: true } })).accountId;
}

async function createPaymentVoucherInTransaction(
  tx: Prisma.TransactionClient,
  input: BasePaymentInput & { module: string; entityType: string; debitAccountId: string; creditAccountId: string; voucherType: VoucherType; documentNo: string },
) {
  await enforcePermission(tx, input.userId, input.module, PermissionAction.CREATE);
  await assertWritableBusinessDate(tx, input);

  const voucher = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo: input.documentNo,
    voucherType: input.voucherType,
    voucherDate: input.transactionDate,
    sourceType: input.entityType,
    sourceId: input.documentNo,
    createdById: input.userId,
    lines: [
      { accountId: input.debitAccountId, debit: input.amount },
      { accountId: input.creditAccountId, credit: input.amount },
    ],
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.documentNo,
    after: { ...input, amount: String(input.amount) },
  });

  return { voucher };
}

export async function cashReceipt(input: BasePaymentInput & { receiptNo: string; customerId: string }) {
  return prisma.$transaction(async (tx) => {
    const cashAccountId = await getCashAccountId(tx, input.companyId);
    const customerAccountId = await customerAccount(tx, input.customerId);
    return createPaymentVoucherInTransaction(tx, { ...input, module: "cash-receipts", entityType: "CashReceipt", documentNo: input.receiptNo, debitAccountId: cashAccountId, creditAccountId: customerAccountId, voucherType: VoucherType.CR });
  });
}

export async function cashPayment(input: BasePaymentInput & { voucherNo: string; vendorId: string }) {
  return prisma.$transaction(async (tx) => {
    const vendorAccountId = await vendorAccount(tx, input.vendorId);
    const cashAccountId = await getCashAccountId(tx, input.companyId);
    return createPaymentVoucherInTransaction(tx, { ...input, module: "cash-payments", entityType: "CashPayment", documentNo: input.voucherNo, debitAccountId: vendorAccountId, creditAccountId: cashAccountId, voucherType: VoucherType.CP });
  });
}

export async function bankReceipt(input: BasePaymentInput & { receiptNo: string; customerId: string; bankId: string }) {
  return prisma.$transaction(async (tx) => {
    const bankAccountId = await getBankAccountId(tx, input.bankId);
    const customerAccountId = await customerAccount(tx, input.customerId);
    return createPaymentVoucherInTransaction(tx, { ...input, module: "bank-receipts", entityType: "BankReceipt", documentNo: input.receiptNo, debitAccountId: bankAccountId, creditAccountId: customerAccountId, voucherType: VoucherType.BR });
  });
}

export async function bankPayment(input: BasePaymentInput & { voucherNo: string; vendorId: string; bankId: string }) {
  return prisma.$transaction(async (tx) => {
    const vendorAccountId = await vendorAccount(tx, input.vendorId);
    const bankAccountId = await getBankAccountId(tx, input.bankId);
    return createPaymentVoucherInTransaction(tx, { ...input, module: "bank-payments", entityType: "BankPayment", documentNo: input.voucherNo, debitAccountId: vendorAccountId, creditAccountId: bankAccountId, voucherType: VoucherType.BP });
  });
}

export type PaymentLineInput = {
  accountId: string;
  amount: number;
  description?: string;
};

export type MultiLinePaymentInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  documentNo: string;
  transactionDate: string | Date;
  narration?: string;
  allowClosedDayOverride?: boolean;
  lines: PaymentLineInput[];
};

async function createMultiLinePaymentVoucher(
  tx: Prisma.TransactionClient,
  input: MultiLinePaymentInput & {
    module: string;
    entityType: string;
    voucherType: VoucherType;
    systemAccountId: string;
    systemSide: "debit" | "credit";
  },
) {
  await enforcePermission(tx, input.userId, input.module, PermissionAction.CREATE);
  await assertWritableBusinessDate(tx, input);

  if (!input.lines.length) throw new Error("lines must not be empty.");
  const total = input.lines.reduce((sum, l) => sum + Number(l.amount), 0);
  if (total <= 0) throw new Error("Total amount must be positive.");

  // Authoritative server-side guard: the user-selected counter lines must be of an
  // account type permitted for this voucher kind, and may not be control accounts.
  // Prevents sales/purchase accounts from being mixed into expense vouchers (and vice-versa).
  await assertPostingAccountsAllowed(tx, input.companyId, input.module as PostingRuleKey, input.lines.map((l) => l.accountId));

  const systemLine = input.systemSide === "debit"
    ? { accountId: input.systemAccountId, debit: total, credit: 0 }
    : { accountId: input.systemAccountId, debit: 0, credit: total };

  const counterLines = input.lines.map((l) => ({
    accountId: l.accountId,
    description: l.description,
    debit: input.systemSide === "debit" ? 0 : Number(l.amount),
    credit: input.systemSide === "debit" ? Number(l.amount) : 0,
  }));

  const allLines = input.systemSide === "debit"
    ? [systemLine, ...counterLines]
    : [...counterLines, systemLine];

  const voucher = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo: input.documentNo,
    voucherType: input.voucherType,
    voucherDate: input.transactionDate,
    narration: input.narration,
    sourceType: input.entityType,
    sourceId: input.documentNo,
    createdById: input.userId,
    lines: allLines,
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.documentNo,
    after: { documentNo: input.documentNo, transactionDate: String(input.transactionDate), narration: input.narration ?? null, lines: input.lines },
  });

  return { voucher };
}

export async function multiLineCashReceipt(input: MultiLinePaymentInput) {
  return prisma.$transaction(async (tx) => {
    const cashAccountId = await getCashAccountId(tx, input.companyId);
    return createMultiLinePaymentVoucher(tx, { ...input, module: "cash-receipts", entityType: "CashReceipt", voucherType: VoucherType.CR, systemAccountId: cashAccountId, systemSide: "debit" });
  });
}

export async function multiLineCashPayment(input: MultiLinePaymentInput) {
  return prisma.$transaction(async (tx) => {
    const cashAccountId = await getCashAccountId(tx, input.companyId);
    return createMultiLinePaymentVoucher(tx, { ...input, module: "cash-payments", entityType: "CashPayment", voucherType: VoucherType.CP, systemAccountId: cashAccountId, systemSide: "credit" });
  });
}

export async function multiLineBankReceipt(input: MultiLinePaymentInput & { bankId: string }) {
  return prisma.$transaction(async (tx) => {
    const bankAccountId = await getBankAccountId(tx, input.bankId);
    return createMultiLinePaymentVoucher(tx, { ...input, module: "bank-receipts", entityType: "BankReceipt", voucherType: VoucherType.BR, systemAccountId: bankAccountId, systemSide: "debit" });
  });
}

export async function multiLineBankPayment(input: MultiLinePaymentInput & { bankId: string }) {
  return prisma.$transaction(async (tx) => {
    const bankAccountId = await getBankAccountId(tx, input.bankId);
    return createMultiLinePaymentVoucher(tx, { ...input, module: "bank-payments", entityType: "BankPayment", voucherType: VoucherType.BP, systemAccountId: bankAccountId, systemSide: "credit" });
  });
}

export async function securityReceipt(
  input: BasePaymentInput & {
    receiptNo: string;
    customerId: string;
    itemId: string;
    bankId?: string;
    quantity?: number;
    receiveMode?: string;
    chequeNo?: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "cash-receipts", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const receiveMode = String(input.receiveMode ?? (input.bankId ? "Bank" : "Cash")).toLowerCase();
    const useBank = receiveMode === "bank" || Boolean(input.bankId);
    const debitAccountId = useBank ? await getBankAccountId(tx, input.bankId!) : await getCashAccountId(tx, input.companyId);
    if (useBank && !input.bankId) throw new Error("bankId is required for bank receipt.");
    const securityLiabilityAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.securityLiability);

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.receiptNo,
      voucherType: useBank ? VoucherType.BR : VoucherType.CR,
      voucherDate: input.transactionDate,
      narration: input.chequeNo ? `Cheque ${input.chequeNo}` : undefined,
      sourceType: "SecurityReceipt",
      sourceId: input.receiptNo,
      createdById: input.userId,
      lines: [
        { accountId: debitAccountId, debit: input.amount },
        { accountId: securityLiabilityAccountId, credit: input.amount },
      ],
    });

    const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;
    await tx.customerCylinderBalance.upsert({
      where: { customerId_itemId: { customerId: input.customerId, itemId: input.itemId } },
      update: { securityHeld: { increment: input.amount } },
      create: { customerId: input.customerId, itemId: input.itemId, securityHeld: input.amount },
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "SecurityReceipt",
      entityId: input.receiptNo,
      after: { ...input, amount: String(input.amount), quantity, receiveMode: input.receiveMode ?? (useBank ? "Bank" : "Cash") },
    });

    return { voucher };
  });
}
