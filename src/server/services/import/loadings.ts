import { AuditAction, BulkStockSourceType, ImportType, PermissionAction, Prisma, ShipmentStatus, StockDirection, UnitOfMeasure } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createBulkStockLedgerEntry } from "../inventory/bulk-stock-ledger.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type CreateInput = { contractId?: string; loadingDate?: string; loadingLocation?: string; stockLocationId?: string; vehicleId?: string; transporterId?: string; quantityLoaded?: string | number; unit?: string; rate?: string | number; freight?: string | number; remarks?: string; allowClosedDayOverride?: boolean };
type ReceiveInput = { arrivalDate?: string; arrivalLocationId?: string; arrivedQuantity?: string | number; allowClosedDayOverride?: boolean };

function required(value: unknown, field: string) { if (value === undefined || value === null || String(value).trim() === "") throw new Error(`${field} is required.`); return String(value).trim(); }
function date(value: unknown, field: string) { const result = new Date(required(value, field)); if (Number.isNaN(result.valueOf())) throw new Error(`${field} is invalid.`); return result; }
function decimal(value: string | number | undefined, field: string, fallback = "0") { const result = new Prisma.Decimal(value === undefined || value === "" ? fallback : value); if (!result.isFinite() || result.isNegative()) throw new Error(`${field} cannot be negative.`); return result; }
function unit(value?: string) { return value && (Object.values(UnitOfMeasure) as string[]).includes(value) ? (value as UnitOfMeasure) : UnitOfMeasure.MT; }
function output(row: any) { return { ...row, quantityLoaded: row.quantityLoaded.toString(), rate: row.rate.toString(), freight: row.freight.toString(), finalRate: row.finalRate.toString(), arrivedQuantity: row.arrivedQuantity?.toString() ?? null, loadingDate: row.loadingDate.toISOString().slice(0, 10), arrivalDate: row.arrivalDate?.toISOString().slice(0, 10) ?? null }; }

async function assertReferences(tx: Prisma.TransactionClient, context: Context, input: CreateInput) {
  const contract = await tx.importContract.findFirst({ where: { id: required(input.contractId, "contractId"), companyId: context.companyId }, select: { id: true, importType: true, vendorId: true, productId: true, quantity: true, status: true } });
  if (!contract) throw new Error("contractId is invalid.");
  if (["CANCELLED", "DISAPPROVED"].includes(contract.status)) throw new Error("Cannot load a cancelled or disapproved contract.");
  const location = await tx.stockLocation.findFirst({ where: { id: required(input.stockLocationId, "stockLocationId"), companyId: context.companyId }, select: { id: true } });
  if (!location) throw new Error("stockLocationId is invalid.");
  if (input.vehicleId && !(await tx.vehicle.findFirst({ where: { id: input.vehicleId, companyId: context.companyId }, select: { id: true } }))) throw new Error("vehicleId is invalid.");
  if (input.transporterId && !(await tx.transporter.findFirst({ where: { id: input.transporterId, companyId: context.companyId }, select: { id: true } }))) throw new Error("transporterId is invalid.");
  return contract;
}

export async function listLoadings(context: Context, shipmentStatus?: string) {
  const rows = await prisma.loading.findMany({ where: { companyId: context.companyId, ...(shipmentStatus ? { shipmentStatus: shipmentStatus as ShipmentStatus } : {}) }, include: { contract: { select: { contractNo: true, importType: true, productId: true } } }, orderBy: [{ loadingDate: "desc" }, { loadingNo: "desc" }], take: 500 });
  const productIds = [...new Set(rows.map((row) => row.contract.productId))]; const locationIds = [...new Set(rows.flatMap((row) => row.stockLocationId ? [row.stockLocationId] : []))];
  const [products, locations] = await Promise.all([prisma.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, name: true } }), prisma.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: locationIds } }, select: { id: true, name: true } })]);
  const productNames = new Map(products.map((row) => [row.id, row.name])); const locationNames = new Map(locations.map((row) => [row.id, row.name]));
  return rows.map((row) => ({ ...output(row), contractNo: row.contract.contractNo, importType: row.contract.importType, productName: productNames.get(row.contract.productId) ?? row.contract.productId, locationName: row.stockLocationId ? locationNames.get(row.stockLocationId) ?? row.stockLocationId : "" }));
}

export async function createLoading(context: Context, input: CreateInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "loadings", PermissionAction.CREATE);
    const contract = await assertReferences(tx, context, input); const loadingDate = date(input.loadingDate, "loadingDate"); await assertWritableBusinessDate(tx, { ...context, transactionDate: loadingDate, allowClosedDayOverride: input.allowClosedDayOverride });
    const quantityLoaded = decimal(input.quantityLoaded, "quantityLoaded"); if (quantityLoaded.isZero()) throw new Error("quantityLoaded must be greater than zero.");
    const existing = await tx.loading.aggregate({ where: { contractId: contract.id }, _sum: { quantityLoaded: true } }); const totalLoaded = new Prisma.Decimal(existing._sum.quantityLoaded ?? 0).plus(quantityLoaded); if (totalLoaded.gt(contract.quantity)) throw new Error("quantityLoaded exceeds the contract quantity.");
    const rate = decimal(input.rate, "rate"); const freight = decimal(input.freight, "freight"); const row = await tx.loading.create({ data: { companyId: context.companyId, financialYearId: context.financialYearId, contractId: contract.id, loadingType: contract.importType, loadingNo: await nextDocumentNumberInTransaction(tx, { ...context, prefix: DOCUMENT_PREFIXES.loading }), loadingDate, loadingLocation: input.loadingLocation?.trim() || null, vehicleId: input.vehicleId || null, transporterId: input.transporterId || null, quantityLoaded, unit: unit(input.unit), rate, freight, finalRate: rate.plus(freight), stockLocationId: input.stockLocationId, shipmentStatus: ShipmentStatus.IN_TRANSIT, remarks: input.remarks?.trim() || null, createdById: context.userId } });
    await createBulkStockLedgerEntry(tx, { companyId: context.companyId, financialYearId: context.financialYearId, productId: contract.productId, locationId: input.stockLocationId as string, direction: StockDirection.IN, quantity: quantityLoaded, unit: unit(input.unit), inTransit: true, sourceType: BulkStockSourceType.LOADING, sourceId: row.id, transactionDate: loadingDate, createdById: context.userId, vendorId: contract.vendorId, remarks: `Loading ${row.loadingNo}` });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Loading", entityId: row.id, after: row }); return output(row);
  });
}

export async function receiveLoading(context: Context, id: string, input: ReceiveInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "loadings", PermissionAction.UPDATE);
    const before = await tx.loading.findFirstOrThrow({ where: { id, companyId: context.companyId }, include: { contract: { select: { productId: true, vendorId: true } } } });
    if (before.shipmentStatus !== ShipmentStatus.IN_TRANSIT && before.shipmentStatus !== ShipmentStatus.ARRIVED) throw new Error("Only in-transit loadings can be received.");
    const arrivalDate = date(input.arrivalDate, "arrivalDate"); const arrivalLocationId = required(input.arrivalLocationId, "arrivalLocationId"); const destination = await tx.stockLocation.findFirst({ where: { id: arrivalLocationId, companyId: context.companyId }, select: { id: true } }); if (!destination) throw new Error("arrivalLocationId is invalid.");
    const receivedNow = decimal(input.arrivedQuantity, "arrivedQuantity"); const alreadyReceived = new Prisma.Decimal(before.arrivedQuantity ?? 0); const arrivedQuantity = alreadyReceived.plus(receivedNow); if (receivedNow.isZero() || arrivedQuantity.gt(before.quantityLoaded)) throw new Error("arrivedQuantity must be positive and the cumulative receipt cannot exceed loaded quantity.");
    await assertWritableBusinessDate(tx, { ...context, transactionDate: arrivalDate, allowClosedDayOverride: input.allowClosedDayOverride });
    await createBulkStockLedgerEntry(tx, { companyId: context.companyId, financialYearId: context.financialYearId, productId: before.contract.productId, locationId: before.stockLocationId as string, direction: StockDirection.OUT, quantity: receivedNow, unit: before.unit, inTransit: true, sourceType: BulkStockSourceType.IMPORT_ARRIVAL, sourceId: before.id, transactionDate: arrivalDate, createdById: context.userId, vendorId: before.contract.vendorId, remarks: `Arrival ${before.loadingNo}` });
    await createBulkStockLedgerEntry(tx, { companyId: context.companyId, financialYearId: context.financialYearId, productId: before.contract.productId, locationId: arrivalLocationId, direction: StockDirection.IN, quantity: receivedNow, unit: before.unit, sourceType: BulkStockSourceType.IMPORT_ARRIVAL, sourceId: before.id, transactionDate: arrivalDate, createdById: context.userId, vendorId: before.contract.vendorId, remarks: `Received ${before.loadingNo}` });
    const complete = arrivedQuantity.eq(before.quantityLoaded); const status = complete ? ShipmentStatus.RECEIVED : ShipmentStatus.IN_TRANSIT;
    const row = await tx.loading.update({ where: { id }, data: { arrivalDate, arrivedQuantity, ...(complete ? { stockLocationId: arrivalLocationId } : {}), shipmentStatus: status } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Loading", entityId: id, before, after: row }); return output(row);
  });
}
