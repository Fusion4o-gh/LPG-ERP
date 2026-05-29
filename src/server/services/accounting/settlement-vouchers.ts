import { PermissionAction, Prisma, VoucherType } from "@prisma/client";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "./document-numbers.ts";
import { getBankAccountId, getCashAccountId } from "./accounts.ts";
import { createBalancedVoucher } from "./vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { enforcePermission } from "../rbac/enforce.ts";

export type SettlementPaymentInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
  partyAccountId: string;
  amount: Prisma.Decimal | string | number;
  payMode?: string;
  bankId?: string;
  chequeNo?: string;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

export function capDiscount(total: Prisma.Decimal, discount: Prisma.Decimal | string | number | undefined) {
  const discountRaw = decimal(discount);
  return discountRaw.gt(total) ? total : discountRaw;
}

export async function postVendorPayment(tx: Prisma.TransactionClient, input: SettlementPaymentInput) {
  const amountPaid = decimal(input.amount);
  if (amountPaid.lte(0)) return null;
  const payMode = String(input.payMode ?? "Credit").toLowerCase();
  if (payMode === "credit") return null;

  if (payMode === "bank") {
    if (!input.bankId) throw new Error("bankId is required for bank payment.");
    await enforcePermission(tx, input.userId, "bank-payments", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);
    const voucherNo = await nextDocumentNumberInTransaction(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      prefix: DOCUMENT_PREFIXES.bankPaymentVoucher,
    });
    const bankAccountId = await getBankAccountId(tx, input.bankId);
    const narration = input.chequeNo ? `Cheque ${input.chequeNo}` : undefined;
    const { voucher } = await createBalancedVoucher(tx, {
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
        { accountId: input.partyAccountId, debit: amountPaid },
        { accountId: bankAccountId, credit: amountPaid },
      ],
    });
    return voucher;
  }

  await enforcePermission(tx, input.userId, "cash-payments", PermissionAction.CREATE);
  await assertWritableBusinessDate(tx, input);
  const voucherNo = await nextDocumentNumberInTransaction(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    prefix: DOCUMENT_PREFIXES.cashPaymentVoucher,
  });
  const cashAccountId = await getCashAccountId(tx, input.companyId);
  const { voucher } = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo,
    voucherType: VoucherType.CP,
    voucherDate: input.transactionDate,
    sourceType: "CashPayment",
    sourceId: voucherNo,
    createdById: input.userId,
    lines: [
      { accountId: input.partyAccountId, debit: amountPaid },
      { accountId: cashAccountId, credit: amountPaid },
    ],
  });
  return voucher;
}

export async function postCustomerReceipt(tx: Prisma.TransactionClient, input: SettlementPaymentInput & { customerId: string }) {
  const amountReceived = decimal(input.amount);
  if (amountReceived.lte(0)) return null;
  const receiveMode = String(input.payMode ?? "Credit").toLowerCase();
  if (receiveMode === "credit") return null;

  if (receiveMode === "bank") {
    if (!input.bankId) throw new Error("bankId is required for bank receipt.");
    await enforcePermission(tx, input.userId, "bank-receipts", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);
    const receiptNo = await nextDocumentNumberInTransaction(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      prefix: DOCUMENT_PREFIXES.bankReceiptVoucher,
    });
    const bankAccountId = await getBankAccountId(tx, input.bankId);
    const narration = input.chequeNo ? `Cheque ${input.chequeNo}` : undefined;
    const { voucher } = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: receiptNo,
      voucherType: VoucherType.BR,
      voucherDate: input.transactionDate,
      narration,
      sourceType: "BankReceipt",
      sourceId: receiptNo,
      createdById: input.userId,
      lines: [
        { accountId: bankAccountId, debit: amountReceived },
        { accountId: input.partyAccountId, credit: amountReceived },
      ],
    });
    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "BankReceipt",
      entityId: receiptNo,
      after: { customerId: input.customerId, amount: String(amountReceived), bankId: input.bankId },
    });
    return voucher;
  }

  await enforcePermission(tx, input.userId, "cash-receipts", PermissionAction.CREATE);
  await assertWritableBusinessDate(tx, input);
  const receiptNo = await nextDocumentNumberInTransaction(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    prefix: DOCUMENT_PREFIXES.cashReceiptVoucher,
  });
  const cashAccountId = await getCashAccountId(tx, input.companyId);
  const { voucher } = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo: receiptNo,
    voucherType: VoucherType.CR,
    voucherDate: input.transactionDate,
    sourceType: "CashReceipt",
    sourceId: receiptNo,
    createdById: input.userId,
    lines: [
      { accountId: cashAccountId, debit: amountReceived },
      { accountId: input.partyAccountId, credit: amountReceived },
    ],
  });
  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "CashReceipt",
    entityId: receiptNo,
    after: { customerId: input.customerId, amount: String(amountReceived) },
  });
  return voucher;
}

/** Pay customer cash/bank against credit balance (e.g. valued cylinder return refund). */
export async function postCustomerRefund(tx: Prisma.TransactionClient, input: SettlementPaymentInput) {
  return postVendorPayment(tx, input);
}
