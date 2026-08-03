import { PermissionAction, Prisma, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "./document-numbers.ts";
import { assertPostingAccountsAllowed } from "./posting-rules.ts";
import { createBalancedVoucher, type VoucherLineInput } from "./vouchers.ts";
import { assertOpeningBalancesUnlocked } from "../opening-balances/opening-lock.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

export type OpeningVoucherLineInput = {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
};

export async function createOpeningVoucher(
  context: Context,
  input: { voucherDate: string; narration?: string; allowClosedDayOverride?: boolean; lines: OpeningVoucherLineInput[] },
) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "opening-voucher", PermissionAction.CREATE);
    await assertOpeningBalancesUnlocked(tx, context);
    await assertWritableBusinessDate(tx, {
      ...context,
      transactionDate: input.voucherDate,
      allowClosedDayOverride: input.allowClosedDayOverride,
    });

    if (!Array.isArray(input.lines) || input.lines.length < 2) {
      throw new Error("Opening voucher must have at least two lines.");
    }

    const lines: VoucherLineInput[] = input.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
    }));

    // Opening vouchers are free-form accounting entries, with the same account
    // safety rules as manual journal vouchers.
    await assertPostingAccountsAllowed(tx, context.companyId, "journal-vouchers", lines.map((line) => line.accountId));

    const voucherNo = await nextDocumentNumberInTransaction(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      prefix: DOCUMENT_PREFIXES.openingVoucher,
    });
    const voucher = await createBalancedVoucher(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      voucherNo,
      voucherType: VoucherType.JV,
      voucherDate: input.voucherDate,
      narration: input.narration || "Opening Voucher",
      sourceType: "OpeningVoucher",
      sourceId: voucherNo,
      createdById: context.userId,
      lines,
    });

    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      entityType: "OpeningVoucher",
      entityId: voucherNo,
      after: { voucherNo, voucherDate: input.voucherDate, narration: input.narration ?? null, lines: input.lines },
    });

    return { voucherNo, voucher };
  });
}

export async function listOpeningVouchers(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "opening-voucher", PermissionAction.VIEW);
    return tx.accountingVoucher.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "OpeningVoucher" },
      select: { id: true, voucherNo: true, voucherDate: true, narration: true, totalDebit: true, totalCredit: true, createdAt: true },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    });
  });
}

export async function listOpeningVoucherAccounts(context: Context) {
  return prisma.chartAccount.findMany({
    where: { companyId: context.companyId, status: "ACTIVE", parentId: { not: null } },
    select: { id: true, code: true, name: true, accountType: true },
    orderBy: { code: "asc" },
  });
}
