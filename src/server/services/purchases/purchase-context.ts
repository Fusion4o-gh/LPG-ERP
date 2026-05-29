import { NormalBalance, PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

function signedBalance(normalBalance: NormalBalance, debit: Prisma.Decimal, credit: Prisma.Decimal) {
  const d = Number(debit);
  const c = Number(credit);
  return normalBalance === NormalBalance.CREDIT ? c - d : d - c;
}

export async function getPurchaseFilledContext(context: Context, input: { vendorId?: string }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "purchase-filled-cylinders", PermissionAction.VIEW);
    if (!input.vendorId) return { vendorBalance: null };

    const vendor = await tx.vendor.findFirst({
      where: { id: input.vendorId, companyId: context.companyId },
      include: { account: { select: { id: true, normalBalance: true } } },
    });
    if (!vendor) return { vendorBalance: null };

    const lines = await tx.accountingVoucherLine.findMany({
      where: {
        accountId: vendor.account.id,
        voucher: { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true },
      },
      select: { debit: true, credit: true },
    });
    const payableBalance = lines.reduce(
      (sum, line) => sum + signedBalance(vendor.account.normalBalance, line.debit, line.credit),
      0,
    );

    return { vendorBalance: { payableBalance } };
  });
}
