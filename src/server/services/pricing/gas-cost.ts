import { PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; userId: string };

export type SetGasCostRateInput = {
  companyId: string;
  costPerKg: string | number | Prisma.Decimal;
  sourceType: "PURCHASE" | "MANUAL";
  sourceId?: string;
  userId: string;
  effectiveFrom?: string | Date;
};

export type ResolveItemCostInput = {
  companyId: string;
  itemId: string;
};

export type ResolveItemCostResult = {
  unitCost: Prisma.Decimal;
  costPerKg: Prisma.Decimal;
  cylinderWeightKg: Prisma.Decimal | null;
};

export async function getCurrentGasCostPerKg(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<{ costPerKg: Prisma.Decimal; effectiveFrom: Date | null }> {
  const latest = await tx.gasCostRate.findFirst({
    where: { companyId },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: { costPerKg: true, effectiveFrom: true },
  });

  if (!latest) {
    return { costPerKg: new Prisma.Decimal(0), effectiveFrom: null };
  }

  return { costPerKg: latest.costPerKg, effectiveFrom: latest.effectiveFrom };
}

export async function setGasCostRate(tx: Prisma.TransactionClient, input: SetGasCostRateInput) {
  const costPerKg = new Prisma.Decimal(input.costPerKg);
  if (costPerKg.lte(0)) {
    throw new Error("costPerKg must be a positive number.");
  }

  return tx.gasCostRate.create({
    data: {
      companyId: input.companyId,
      costPerKg,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
      createdById: input.userId,
    },
  });
}

export async function resolveItemCost(
  tx: Prisma.TransactionClient,
  input: ResolveItemCostInput,
): Promise<ResolveItemCostResult> {
  const item = await tx.item.findUniqueOrThrow({
    where: { id: input.itemId },
    select: { cylinderWeightKg: true },
  });

  const { costPerKg } = await getCurrentGasCostPerKg(tx, input.companyId);
  const cylinderWeightKg = item.cylinderWeightKg;

  if (cylinderWeightKg == null) {
    return { unitCost: costPerKg, costPerKg, cylinderWeightKg: null };
  }

  const unitCost = costPerKg.times(cylinderWeightKg).toDecimalPlaces(2);
  return { unitCost, costPerKg, cylinderWeightKg };
}

export async function getGasCostSetting(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "company", PermissionAction.VIEW);
    const { costPerKg, effectiveFrom } = await getCurrentGasCostPerKg(tx, context.companyId);
    return { costPerKg: costPerKg.toString(), effectiveFrom };
  });
}

export async function setGasCostSetting(context: Context, input: { costPerKg: number | string }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "company", PermissionAction.UPDATE);
    const rate = await setGasCostRate(tx, {
      companyId: context.companyId,
      costPerKg: input.costPerKg,
      sourceType: "MANUAL",
      userId: context.userId,
    });
    return { costPerKg: rate.costPerKg.toString(), effectiveFrom: rate.effectiveFrom };
  });
}
