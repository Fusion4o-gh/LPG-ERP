import { AuditAction, BulkStockSourceType, PermissionAction, Prisma, StockDirection, UnitOfMeasure } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { createBulkStockLedgerEntry } from "../inventory/bulk-stock-ledger.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

type BulkOpeningInput = {
  productId?: string;
  locationId?: string;
  quantity?: string | number;
  unit?: string;
  valuationRate?: string | number;
  transactionDate?: string | Date;
};

function positiveDecimal(value: string | number | undefined, field: string) {
  const amount = new Prisma.Decimal(value ?? 0);
  if (!amount.isFinite() || amount.lte(0)) throw new Error(`${field} must be a positive number.`);
  return amount;
}

function nonNegativeDecimal(value: string | number | undefined) {
  const amount = new Prisma.Decimal(value ?? 0);
  if (!amount.isFinite() || amount.isNegative()) throw new Error("valuationRate cannot be negative.");
  return amount;
}

function required(value: string | undefined, field: string) {
  if (!value?.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function unit(value?: string) {
  return value && (Object.values(UnitOfMeasure) as string[]).includes(value) ? (value as UnitOfMeasure) : UnitOfMeasure.MT;
}

export async function listBulkOpeningStock(context: Context) {
  const rows = await prisma.bulkOpeningStock.findMany({
    where: { companyId: context.companyId, financialYearId: context.financialYearId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const productIds = [...new Set(rows.map((r) => r.productId))];
  const locationIds = [...new Set(rows.map((r) => r.locationId))];
  const [products, locations] = await Promise.all([
    prisma.bulkProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
    prisma.stockLocation.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } }),
  ]);
  const productById = new Map(products.map((p) => [p.id, p.name]));
  const locationById = new Map(locations.map((l) => [l.id, l.name]));
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    locationId: r.locationId,
    productName: productById.get(r.productId) ?? "",
    locationName: locationById.get(r.locationId) ?? "",
    quantity: r.quantity.toString(),
    unit: r.unit,
    valuationRate: r.valuationRate.toString(),
    locked: r.locked,
  }));
}

export async function createBulkOpeningStock(context: Context, input: BulkOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "bulk-opening-stock", PermissionAction.CREATE);
    const productId = required(input.productId, "productId");
    const locationId = required(input.locationId, "locationId");
    const quantity = positiveDecimal(input.quantity, "quantity");
    const valuationRate = nonNegativeDecimal(input.valuationRate);
    const transactionDate = input.transactionDate ? new Date(input.transactionDate) : new Date();

    const existing = await tx.bulkOpeningStock.findUnique({
      where: { companyId_financialYearId_productId_locationId: { companyId: context.companyId, financialYearId: context.financialYearId, productId, locationId } },
      select: { id: true },
    });
    if (existing) throw new Error("Opening stock already exists for this product and location.");

    const row = await tx.bulkOpeningStock.create({
      data: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        productId,
        locationId,
        quantity,
        unit: unit(input.unit),
        valuationRate,
        createdById: context.userId,
      },
    });

    await createBulkStockLedgerEntry(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      productId,
      locationId,
      direction: StockDirection.IN,
      quantity,
      unit: unit(input.unit),
      sourceType: BulkStockSourceType.OPENING_STOCK,
      sourceId: row.id,
      transactionDate,
      createdById: context.userId,
      remarks: "Bulk opening stock",
    });

    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "BulkOpeningStock", entityId: row.id, after: row });
    return row;
  });
}

export async function updateBulkOpeningStock(context: Context, id: string, input: BulkOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "bulk-opening-stock", PermissionAction.UPDATE);
    const before = await tx.bulkOpeningStock.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    if (before.locked) throw new Error("Opening stock is locked and cannot be edited.");
    const quantity = positiveDecimal(input.quantity, "quantity");
    const valuationRate = nonNegativeDecimal(input.valuationRate);
    const transactionDate = input.transactionDate ? new Date(input.transactionDate) : new Date();

    const delta = quantity.minus(before.quantity);
    if (!delta.isZero()) {
      await createBulkStockLedgerEntry(tx, {
        companyId: context.companyId,
        financialYearId: before.financialYearId,
        productId: before.productId,
        locationId: before.locationId,
        direction: delta.isPositive() ? StockDirection.IN : StockDirection.OUT,
        quantity: delta.abs(),
        unit: before.unit,
        sourceType: BulkStockSourceType.ADJUSTMENT,
        sourceId: before.id,
        transactionDate,
        createdById: context.userId,
        remarks: "Bulk opening stock adjustment",
        allowNegative: true,
      });
    }

    const row = await tx.bulkOpeningStock.update({ where: { id }, data: { quantity, valuationRate, unit: unit(input.unit) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "BulkOpeningStock", entityId: id, before, after: row });
    return row;
  });
}
