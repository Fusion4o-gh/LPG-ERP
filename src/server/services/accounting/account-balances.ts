import { AccountType, NormalBalance, PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

function signedBalance(normalBalance: NormalBalance, debit: number, credit: number) {
  return normalBalance === NormalBalance.CREDIT ? credit - debit : debit - credit;
}

async function accountBalance(
  tx: Prisma.TransactionClient,
  context: Context,
  accountId: string,
) {
  const account = await tx.chartAccount.findFirst({
    where: { id: accountId, companyId: context.companyId },
    select: { normalBalance: true },
  });
  if (!account) return 0;

  const lines = await tx.accountingVoucherLine.aggregate({
    where: {
      accountId,
      voucher: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        isPosted: true,
      },
    },
    _sum: { debit: true, credit: true },
  });

  return signedBalance(account.normalBalance, Number(lines._sum.debit ?? 0), Number(lines._sum.credit ?? 0));
}

export async function getSettlementBalancePreview(context: Context, input: { bankId?: string }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);

    const cashAccount = await tx.chartAccount.findFirst({
      where: { companyId: context.companyId, accountType: AccountType.ASSET, name: { contains: "Cash", mode: "insensitive" } },
      select: { id: true },
    });

    let bankBalance: number | null = null;
    if (input.bankId) {
      const bank = await tx.bank.findFirst({
        where: { id: input.bankId, companyId: context.companyId },
        select: { accountId: true },
      });
      if (bank) bankBalance = await accountBalance(tx, context, bank.accountId);
    }

    return {
      cashInHand: cashAccount ? await accountBalance(tx, context, cashAccount.id) : 0,
      bankBalance,
    };
  });
}
