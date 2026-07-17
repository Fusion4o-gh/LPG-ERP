import { Prisma } from "@prisma/client";

export type ResolveItemPriceInput = {
  companyId: string;
  itemId: string;
  customerId?: string;
  vendorId?: string;
  transactionDate: string | Date;
  centralizedPricing?: boolean;
};

export type ResolveItemPriceResult = {
  unitPrice: Prisma.Decimal;
  pricePerKg: Prisma.Decimal | null;
  cylinderWeightKg: Prisma.Decimal | null;
  usingKgPricing: boolean;
};

export type KgPricingSnapshot = {
  unitPrice: string;
  pricePerKg: string | null;
  cylinderWeightKg: string | null;
  usingKgPricing: boolean;
};

function toKgPricingSnapshot(result: ResolveItemPriceResult): KgPricingSnapshot {
  return {
    unitPrice: result.unitPrice.toString(),
    pricePerKg: result.pricePerKg?.toString() ?? null,
    cylinderWeightKg: result.cylinderWeightKg?.toString() ?? null,
    usingKgPricing: result.usingKgPricing,
  };
}

async function findItemPriceRecord(
  tx: Prisma.TransactionClient,
  input: ResolveItemPriceInput,
  customerId: string | null,
) {
  return tx.itemPrice.findFirst({
    where: {
      itemId: input.itemId,
      customerId,
      validFrom: { lte: new Date(input.transactionDate) },
      OR: [{ validTo: null }, { validTo: { gte: new Date(input.transactionDate) } }],
    },
    orderBy: { validFrom: "desc" },
    include: { item: { select: { cylinderWeightKg: true, companyId: true } } },
  });
}

function buildPriceResult(itemPrice: NonNullable<Awaited<ReturnType<typeof findItemPriceRecord>>>): ResolveItemPriceResult {
  const cylinderWeightKg = itemPrice.item.cylinderWeightKg;
  const pricePerKg = itemPrice.pricePerKg;

  if (pricePerKg != null && cylinderWeightKg != null) {
    const derivedUnitPrice = pricePerKg.times(cylinderWeightKg).toDecimalPlaces(2);
    return { unitPrice: derivedUnitPrice, pricePerKg, cylinderWeightKg, usingKgPricing: true };
  }

  return {
    unitPrice: itemPrice.price,
    pricePerKg: pricePerKg ?? null,
    cylinderWeightKg,
    usingKgPricing: false,
  };
}

export async function resolveItemPrice(
  tx: Prisma.TransactionClient,
  input: ResolveItemPriceInput,
): Promise<ResolveItemPriceResult> {
  const effectiveCustomerId = input.centralizedPricing ? null : (input.customerId ?? null);

  let itemPrice = await findItemPriceRecord(tx, input, effectiveCustomerId);
  if (!itemPrice && !input.centralizedPricing && input.customerId) {
    itemPrice = await findItemPriceRecord(tx, input, null);
  }

  if (!itemPrice) {
    throw new Error(`No price found for item ${input.itemId}`);
  }

  if (itemPrice.item.companyId !== input.companyId) {
    throw new Error(`No price found for item ${input.itemId}`);
  }

  return buildPriceResult(itemPrice);
}

export async function tryResolveItemPrice(
  tx: Prisma.TransactionClient,
  input: ResolveItemPriceInput,
): Promise<KgPricingSnapshot | null> {
  try {
    return toKgPricingSnapshot(await resolveItemPrice(tx, input));
  } catch {
    return null;
  }
}

export async function resolveKgPricingMap(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    itemIds: string[];
    customerId?: string;
    transactionDate: string | Date;
    centralizedPricing: boolean;
  },
): Promise<Record<string, KgPricingSnapshot | null>> {
  const kgPricing: Record<string, KgPricingSnapshot | null> = {};
  for (const itemId of input.itemIds) {
    kgPricing[itemId] = await tryResolveItemPrice(tx, {
      companyId: input.companyId,
      itemId,
      customerId: input.customerId,
      transactionDate: input.transactionDate,
      centralizedPricing: input.centralizedPricing,
    });
  }
  return kgPricing;
}

export async function assertCentralizedLinePrices(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    customerId?: string;
    transactionDate: string | Date;
    lines: { itemId: string; unitAmount: string | number | Prisma.Decimal }[];
    amountLabel?: string;
  },
) {
  const company = await tx.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { centralizedPricing: true },
  });
  if (!company.centralizedPricing) return;

  const label = input.amountLabel ?? "unit price";
  for (const [index, line] of input.lines.entries()) {
    const resolved = await tryResolveItemPrice(tx, {
      companyId: input.companyId,
      itemId: line.itemId,
      customerId: input.customerId,
      transactionDate: input.transactionDate,
      centralizedPricing: true,
    });
    if (!resolved) continue;

    const submitted = new Prisma.Decimal(line.unitAmount);
    const expected = new Prisma.Decimal(resolved.unitPrice);
    if (submitted.minus(expected).abs().gt(0.01)) {
      throw new Error(
        `Line ${index + 1}: ${label} must match centralized master price ${expected.toFixed(2)} when centralized pricing is enabled.`,
      );
    }
  }
}
