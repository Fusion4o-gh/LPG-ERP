import { PermissionAction, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "./document-numbers.ts";
import { assertBalancedVoucher, createBalancedVoucher, type VoucherLineInput } from "./vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

export type JvLineInput = {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
};

export type CreateJournalVoucherInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  voucherDate: string;
  narration?: string;
  allowClosedDayOverride?: boolean;
  lines: JvLineInput[];
};

export async function createJournalVoucher(input: CreateJournalVoucherInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "journal-vouchers", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      userId: input.userId,
      transactionDate: input.voucherDate,
      allowClosedDayOverride: input.allowClosedDayOverride,
    });

    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error("Journal voucher must have at least one line.");
    }

    const voucherLines: VoucherLineInput[] = input.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
    }));

    // assertBalancedVoucher is called inside createBalancedVoucher
    assertBalancedVoucher(voucherLines);

    const voucherNo = await nextDocumentNumberInTransaction(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      prefix: DOCUMENT_PREFIXES.journalVoucher,
    });

    const voucher = await createBalancedVoucher(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo,
      voucherType: VoucherType.JV,
      voucherDate: input.voucherDate,
      narration: input.narration,
      sourceType: "JournalVoucher",
      sourceId: voucherNo,
      createdById: input.userId,
      lines: voucherLines,
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "JournalVoucher",
      entityId: voucherNo,
      after: {
        voucherNo,
        voucherDate: input.voucherDate,
        narration: input.narration ?? null,
        lines: input.lines,
      },
    });

    return { voucherNo, voucher };
  });
}

export async function listJournalVouchers(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "journal-vouchers", PermissionAction.VIEW);
    return tx.accountingVoucher.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        voucherType: VoucherType.JV,
        sourceType: "JournalVoucher",
      },
      select: {
        id: true,
        voucherNo: true,
        voucherDate: true,
        narration: true,
        totalDebit: true,
        totalCredit: true,
        createdAt: true,
      },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    });
  });
}
