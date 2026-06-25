import { NormalBalance, PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { resolveItemPrice } from "../pricing/kg-pricing.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

function signedBalance(normalBalance: NormalBalance, debit: Prisma.Decimal, credit: Prisma.Decimal) {
  const d = Number(debit);
  const c = Number(credit);
  return normalBalance === NormalBalance.CREDIT ? c - d : d - c;
}

export async function getPurchaseFilledContext(context: Context, input: { vendorId?: string; itemIds?: string[] }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "purchase-filled-cylinders", PermissionAction.VIEW);

    let vendorBalance: { payableBalance: number } | null = null;
    if (input.vendorId) {
      const vendor = await tx.vendor.findFirst({
        where: { id: input.vendorId, companyId: context.companyId },
        include: { account: { select: { id: true, normalBalance: true } } },
      });
      if (vendor) {
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
        vendorBalance = { payableBalance };
      }
    }

    // Resolve KG pricing for each item
    const itemIds = input.itemIds ?? [];
    const kgPricing: Record<string, { unitPrice: string; pricePerKg: string | null; cylinderWeightKg: string | null; usingKgPricing: boolean } | null> = {};
    const transactionDate = new Date().toISOString();
    for (const itemId of itemIds) {
      try {
        const result = await resolveItemPrice(tx, {
          companyId: context.companyId,
          itemId,
          transactionDate,
        });
        kgPricing[itemId] = {
          unitPrice: result.unitPrice.toString(),
          pricePerKg: result.pricePerKg?.toString() ?? null,
          cylinderWeightKg: result.cylinderWeightKg?.toString() ?? null,
          usingKgPricing: result.usingKgPricing,
        };
      } catch {
        kgPricing[itemId] = null;
      }
    }

    return { vendorBalance, kgPricing };
  });
}
