import { PermissionAction, Prisma, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { getBankAccountId, getCashAccountId, getAccountIdByCode, ACCOUNT_CODES } from "../accounting/accounts.ts";
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

export async function securityReceipt(input: BasePaymentInput & { receiptNo: string; customerId: string; itemId: string; bankId?: string }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "cash-receipts", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const debitAccountId = input.bankId ? await getBankAccountId(tx, input.bankId) : await getCashAccountId(tx, input.companyId);
    const securityLiabilityAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.securityLiability);

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.receiptNo,
      voucherType: input.bankId ? VoucherType.BR : VoucherType.CR,
      voucherDate: input.transactionDate,
      sourceType: "SecurityReceipt",
      sourceId: input.receiptNo,
      createdById: input.userId,
      lines: [
        { accountId: debitAccountId, debit: input.amount },
        { accountId: securityLiabilityAccountId, credit: input.amount },
      ],
    });

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
      after: { ...input, amount: String(input.amount) },
    });

    return { voucher };
  });
}
