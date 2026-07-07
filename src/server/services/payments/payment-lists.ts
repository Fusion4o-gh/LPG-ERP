import { PermissionAction, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type ListInput = {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  search?: string;
};

export async function listPaymentVouchers(
  context: { companyId: string; financialYearId: string; userId: string },
  input: ListInput & { voucherType: VoucherType; sourceType: string; module: string },
) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, input.module, PermissionAction.VIEW);
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;
    if (to) to.setUTCHours(23, 59, 59, 999);
    const pageSize = Math.min(Math.max(input.limit ?? 10, 1), 100);
    const offset = Math.max(input.offset ?? 0, 0);
    const search = input.search?.trim().toLowerCase();

    const where = {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      voucherType: input.voucherType,
      sourceType: input.sourceType,
      ...(from || to
        ? {
            voucherDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [{ voucherNo: { contains: search, mode: "insensitive" as const } }, { sourceId: { contains: search, mode: "insensitive" as const } }],
          }
        : {}),
    };

    const [total, vouchers] = await Promise.all([
      tx.accountingVoucher.count({ where }),
      tx.accountingVoucher.findMany({
        where,
        orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: pageSize,
        select: {
          id: true,
          voucherNo: true,
          voucherType: true,
          voucherDate: true,
          totalDebit: true,
          sourceId: true,
        },
      }),
    ]);

    return {
      vouchers: vouchers.map((voucher) => ({
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        voucherType: voucher.voucherType,
        transactionDate: voucher.voucherDate,
        totalAmount: String(voucher.totalDebit),
        sourceId: voucher.sourceId,
      })),
      total,
      limit: pageSize,
      offset,
    };
  });
}

export async function listCashPayments(context: { companyId: string; financialYearId: string; userId: string }, input: ListInput) {
  return listPaymentVouchers(context, {
    ...input,
    voucherType: VoucherType.CP,
    sourceType: "CashPayment",
    module: "cash-payments",
  });
}

export async function listCashReceipts(context: { companyId: string; financialYearId: string; userId: string }, input: ListInput) {
  return listPaymentVouchers(context, {
    ...input,
    voucherType: VoucherType.CR,
    sourceType: "CashReceipt",
    module: "cash-receipts",
  });
}
