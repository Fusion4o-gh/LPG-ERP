import { type Prisma } from "@prisma/client";

export type ResolveItemPriceInput = {
  companyId: string;
  itemId: string;
  customerId?: string;
  vendorId?: string;
  transactionDate: string | Date;
};

export type ResolveItemPriceResult = {
  unitPrice: Prisma.Decimal;
  pricePerKg: Prisma.Decimal | null;
  cylinderWeightKg: Prisma.Decimal | null;
  usingKgPricing: boolean;
};

export async function resolveItemPrice(
  tx: Prisma.TransactionClient,
  input: ResolveItemPriceInput,
): Promise<ResolveItemPriceResult> {
  const itemPrice = await tx.itemPrice.findFirst({
    where: {
      itemId: input.itemId,
      customerId: input.customerId ?? null,
      validFrom: { lte: new Date(input.transactionDate) },
      OR: [
        { validTo: null },
        { validTo: { gte: new Date(input.transactionDate) } },
      ],
    },
    orderBy: [{ customerId: "desc" }, { validFrom: "desc" }],
    include: { item: { select: { cylinderWeightKg: true } } },
  });

  if (!itemPrice) {
    throw new Error(`No price found for item ${input.itemId}`);
  }

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
