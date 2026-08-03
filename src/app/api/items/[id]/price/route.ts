import { AuditAction, PermissionAction } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { dateField, optionalPositiveNumberField, optionalStringField, readJson } from "../../../../../server/api/validation.ts";
import { writeAuditLog } from "../../../../../server/services/audit/audit-log.ts";
import { enforcePermission } from "../../../../../server/services/rbac/enforce.ts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    await prisma.$transaction((tx) => enforcePermission(tx, context.userId, "items", PermissionAction.VIEW));
    const { id: itemId } = await params;
    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId: context.companyId },
      select: { id: true, code: true, name: true, cylinderWeightKg: true },
    });
    if (!item) return fail("Item not found.");
    const prices = await prisma.itemPrice.findMany({
      where: { itemId },
      include: { customer: { select: { id: true, code: true, name: true } } },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    });
    return ok({
      item: { ...item, cylinderWeightKg: item.cylinderWeightKg == null ? null : String(item.cylinderWeightKg) },
      prices: prices.map((price) => ({
        id: price.id,
        customerId: price.customerId,
        customerName: price.customer ? `${price.customer.code} - ${price.customer.name}` : "Default price",
        price: String(price.price),
        pricePerKg: price.pricePerKg == null ? "" : String(price.pricePerKg),
        validFrom: price.validFrom.toISOString().slice(0, 10),
        validTo: price.validTo?.toISOString().slice(0, 10) ?? "",
      })),
    });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    await prisma.$transaction((tx) => enforcePermission(tx, context.userId, "items", PermissionAction.UPDATE));
    const body = await readJson(request);
    const { id: itemId } = await params;

    const item = await prisma.item.findUnique({
      where: { id: itemId, companyId: context.companyId },
      select: { id: true, cylinderWeightKg: true },
    });
    if (!item) return fail("Item not found.");

    // Validate: if pricePerKg is set, must have cylinderWeightKg on the item
    const pricePerKg = optionalPositiveNumberField(body, "pricePerKg");
    if (pricePerKg != null) {
      if (item.cylinderWeightKg == null) {
        return fail("Cannot set pricePerKg: item has no cylinderWeightKg defined.");
      }
    }

    const customerId = optionalStringField(body, "customerId") ?? null;
    if (customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId: context.companyId }, select: { id: true } });
      if (!customer) return fail("Customer not found.");
    }
    const price = optionalPositiveNumberField(body, "price");
    const validFrom = dateField(body, "validFrom");
    const validTo = optionalStringField(body, "validTo") ?? null;
    if (validTo && new Date(validTo) < new Date(validFrom)) return fail("validTo cannot be before validFrom.");
    if (price == null && pricePerKg == null) return fail("Set a price or price per kg.");

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
      const before = {
        id: record.id,
        itemId: record.itemId,
        customerId: record.customerId,
        price: String(record.price),
        pricePerKg: record.pricePerKg == null ? null : String(record.pricePerKg),
        validFrom: record.validFrom.toISOString(),
        validTo: record.validTo?.toISOString() ?? null,
      };
      const updated = await prisma.itemPrice.update({
        where: { id: record.id },
        data: {
          ...(price != null ? { price } : {}),
          ...(pricePerKg != null ? { pricePerKg } : {}),
        },
      });
      await prisma.$transaction((tx) =>
        writeAuditLog(tx, {
          companyId: context.companyId,
          userId: context.userId,
          action: AuditAction.UPDATE,
          entityType: "ItemPrice",
          entityId: updated.id,
          before,
          after: {
            id: updated.id,
            itemId: updated.itemId,
            customerId: updated.customerId,
            price: String(updated.price),
            pricePerKg: updated.pricePerKg == null ? null : String(updated.pricePerKg),
            validFrom: updated.validFrom.toISOString(),
            validTo: updated.validTo?.toISOString() ?? null,
          },
        }),
      );
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

    await prisma.$transaction((tx) =>
      writeAuditLog(tx, {
        companyId: context.companyId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entityType: "ItemPrice",
        entityId: itemPrice.id,
        after: {
          id: itemPrice.id,
          itemId: itemPrice.itemId,
          customerId: itemPrice.customerId,
          price: String(itemPrice.price),
          pricePerKg: itemPrice.pricePerKg == null ? null : String(itemPrice.pricePerKg),
          validFrom: itemPrice.validFrom.toISOString(),
          validTo: itemPrice.validTo?.toISOString() ?? null,
        },
      }),
    );

    return ok({ itemPrice });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
