import { PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { getFilledStockByItem } from "../inventory/stock-availability.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

function signedBalance(normalBalance: string, debit: Prisma.Decimal, credit: Prisma.Decimal) {
  const d = Number(debit);
  const c = Number(credit);
  return normalBalance === "CREDIT" ? c - d : d - c;
}

export async function getSaleLpgContext(context: Context, input: { customerId?: string; itemIds?: string[] }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "sale-lpg", PermissionAction.VIEW);

    let customerBalance: { receivableBalance: number; emptyOwed: number; filledOutstanding: number } | null = null;
    if (input.customerId) {
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, companyId: context.companyId },
        include: { account: { select: { id: true, normalBalance: true } } },
      });
      if (customer) {
        const lines = await tx.accountingVoucherLine.findMany({
          where: {
            accountId: customer.account.id,
            voucher: { companyId: context.companyId, financialYearId: context.financialYearId, isPosted: true },
          },
          select: { debit: true, credit: true },
        });
        const receivableBalance = lines.reduce(
          (sum, line) => sum + signedBalance(customer.account.normalBalance, line.debit, line.credit),
          0,
        );
        const cylinderRows = await tx.customerCylinderBalance.findMany({
          where: { customerId: customer.id },
          select: { emptyOwed: true, filledOutstanding: true },
        });
        customerBalance = {
          receivableBalance,
          emptyOwed: cylinderRows.reduce((sum, row) => sum + row.emptyOwed, 0),
          filledOutstanding: cylinderRows.reduce((sum, row) => sum + row.filledOutstanding, 0),
        };
      }
    }

    const itemIds = input.itemIds ?? [];
    const stockMap = await getFilledStockByItem(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      itemIds,
    });
    const filledStock = Object.fromEntries(itemIds.map((id) => [id, stockMap.get(id) ?? 0]));

    const company = await tx.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: {
        stockAvailableCheck: true,
        centralizedPricing: true,
        showDefaultDate: true,
        redirectOnSamePage: true,
      },
    });

    return { customerBalance, filledStock, company };
  });
}
