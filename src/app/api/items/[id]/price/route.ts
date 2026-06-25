import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { dateField, optionalPositiveNumberField, optionalStringField, readJson } from "../../../../../server/api/validation.ts";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id: itemId } = await params;

    // Validate: if pricePerKg is set, must have cylinderWeightKg on the item
    const pricePerKg = optionalPositiveNumberField(body, "pricePerKg");
    if (pricePerKg != null) {
      const item = await prisma.item.findUnique({
        where: { id: itemId, companyId: context.companyId },
        select: { cylinderWeightKg: true },
      });
      if (!item) return fail("Item not found.");
      if (item.cylinderWeightKg == null) {
        return fail("Cannot set pricePerKg: item has no cylinderWeightKg defined.");
      }
    }

    const customerId = optionalStringField(body, "customerId") ?? null;
    const price = optionalPositiveNumberField(body, "price");
    const validFrom = dateField(body, "validFrom");
    const validTo = optionalStringField(body, "validTo") ?? null;

    // Upsert the applicable ItemPrice record
    const record = await prisma.itemPrice.findFirst({
      where: {
        itemId,
        customerId,
        validFrom: { lte: new Date(validFrom) },
        OR: [
          { validTo: null },
          { validTo: { gte: new Date(validFrom) } },
        ],
      },
      orderBy: [{ customerId: "desc" }, { validFrom: "desc" }],
    });

    if (record && price == null && validTo == null) {
      // Update existing record
      const updated = await prisma.itemPrice.update({
        where: { id: record.id },
        data: {
          ...(price != null ? { price } : {}),
          ...(pricePerKg != null ? { pricePerKg } : {}),
        },
      });
      return ok({ itemPrice: updated });
    }

    // Create new ItemPrice record
    const itemPrice = await prisma.itemPrice.create({
      data: {
        itemId,
        customerId,
        price: price ?? 0,
        pricePerKg: pricePerKg ?? null,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : null,
      },
    });

    return ok({ itemPrice });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
