import { PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Filters = { from?: string; to?: string; productId?: string; locationId?: string; status?: string; driverId?: string };

function date(value: string | undefined, field: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${field} is invalid.`);
  return parsed;
}

function range(filters: Filters) {
  const from = date(filters.from, "from");
  const to = date(filters.to, "to");
  if (from && to && from > to) throw new Error("from must be before or equal to to.");
  return { from, to };
}

function cell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\n");
}

export async function getStockAdjustmentReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.lossGain.findMany({ where: { companyId: context.companyId, productId: filters.productId, locationId: filters.locationId, ...(filters.status ? { status: filters.status as never } : {}), transactionDate: { gte: from, lte: to } }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] });
    const productIds = [...new Set(rows.map((row) => row.productId))];
    const locationIds = [...new Set(rows.map((row) => row.locationId))];
    const [products, locations] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: locationIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const productById = new Map(products.map((row) => [row.id, row]));
    const locationById = new Map(locations.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, documentNo: row.documentNo, date: row.transactionDate.toISOString().slice(0, 10), type: row.type, product: productById.get(row.productId), location: locationById.get(row.locationId), expectedQuantity: row.expectedQuantity.toString(), actualQuantity: row.actualQuantity.toString(), difference: row.difference.toString(), rate: row.rate.toString(), financialImpact: row.financialImpact.toString(), status: row.status, postedToPl: row.postedToPl, reason: row.reason ?? "" })) };
  });
}

export async function getStockAdjustmentReportCsv(context: Context, filters: Filters = {}) {
  const report = await getStockAdjustmentReport(context, filters);
  return csv(["Document No", "Date", "Type", "Product", "Location", "Expected", "Actual", "Difference", "Rate", "Financial Impact", "Status", "Posted To P&L", "Reason"], report.rows.map((row) => [row.documentNo, row.date, row.type, row.product?.name ?? "", row.location?.name ?? "", row.expectedQuantity, row.actualQuantity, row.difference, row.rate, row.financialImpact, row.status, row.postedToPl, row.reason]));
}

export async function getPlantDecantReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.plantDecanting.findMany({ where: { companyId: context.companyId, productId: filters.productId, sourceLocationId: filters.locationId, transactionDate: { gte: from, lte: to } }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] });
    const plantIds = [...new Set(rows.map((row) => row.plantId))];
    const productIds = [...new Set(rows.map((row) => row.productId))];
    const locationIds = [...new Set(rows.flatMap((row) => [row.sourceLocationId, row.destinationLocationId]))];
    const vehicleIds = [...new Set(rows.map((row) => row.vehicleId).filter((id): id is string => Boolean(id)))];
    const transporterIds = [...new Set(rows.map((row) => row.transporterId).filter((id): id is string => Boolean(id)))];
    const [plants, products, locations, vehicles, transporters] = await Promise.all([
      tx.plant.findMany({ where: { companyId: context.companyId, id: { in: plantIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: locationIds } }, select: { id: true, code: true, name: true } }),
      tx.vehicle.findMany({ where: { companyId: context.companyId, id: { in: vehicleIds } }, select: { id: true, registrationNo: true } }),
      tx.transporter.findMany({ where: { companyId: context.companyId, id: { in: transporterIds } }, select: { id: true, name: true } }),
    ]);
    const map = <T extends { id: string }>(values: T[]) => new Map(values.map((row) => [row.id, row]));
    const pm = map(plants); const productById = map(products); const lm = map(locations); const vm = map(vehicles); const tm = map(transporters);
    return { rows: rows.map((row) => ({ id: row.id, documentNo: row.documentNo, date: row.transactionDate.toISOString().slice(0, 10), plant: pm.get(row.plantId), product: productById.get(row.productId), sourceLocation: lm.get(row.sourceLocationId), destinationLocation: lm.get(row.destinationLocationId), vehicle: row.vehicleId ? vm.get(row.vehicleId) : undefined, transporter: row.transporterId ? tm.get(row.transporterId) : undefined, quantity: row.quantity.toString(), unit: row.unit, rate: row.rate.toString(), amount: row.amount.toString(), remarks: row.remarks ?? "" })) };
  });
}

export async function getPlantDecantReportCsv(context: Context, filters: Filters = {}) {
  const report = await getPlantDecantReport(context, filters);
  return csv(["Document No", "Date", "Plant", "Product", "Source Location", "Destination Location", "Vehicle", "Transporter", "Quantity", "Unit", "Rate", "Amount", "Remarks"], report.rows.map((row) => [row.documentNo, row.date, row.plant?.name ?? "", row.product?.name ?? "", row.sourceLocation?.name ?? "", row.destinationLocation?.name ?? "", row.vehicle?.registrationNo ?? "", row.transporter?.name ?? "", row.quantity, row.unit, row.rate, row.amount, row.remarks]));
}

export async function getPartialSaleStatusReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.partialReceiving.findMany({ where: { companyId: context.companyId, productId: filters.productId, locationId: filters.locationId, ...(filters.status ? { arrivalStatus: filters.status as never } : {}), transactionDate: { gte: from, lte: to } }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] });
    const productIds = [...new Set(rows.map((row) => row.productId))];
    const plantIds = [...new Set(rows.map((row) => row.plantId))];
    const [products, plants] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.plant.findMany({ where: { companyId: context.companyId, id: { in: plantIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const pm = new Map(products.map((row) => [row.id, row])); const plantById = new Map(plants.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, documentNo: row.documentNo, date: row.transactionDate.toISOString().slice(0, 10), plant: plantById.get(row.plantId), product: pm.get(row.productId), dispatchWeight: row.dispatchWeight.toString(), totalQuantity: row.totalQuantity.toString(), receivedQuantity: row.receivedQuantity.toString(), remainingQuantity: row.remainingQuantity.toString(), unit: row.unit, status: row.arrivalStatus, saleStatus: row.saleStatus ?? "", amount: row.amount.toString(), loadWeight: row.loadWeight.toString(), finalRate: row.finalRate.toString(), remarks: row.remarks ?? "" })) };
  });
}

export async function getPartialSaleStatusReportCsv(context: Context, filters: Filters = {}) {
  const report = await getPartialSaleStatusReport(context, filters);
  return csv(["Document No", "Date", "Plant", "Product", "Dispatch Weight", "Total", "Received", "Remaining", "Unit", "Status", "Sale Status", "Amount", "Load Weight", "Final Rate", "Remarks"], report.rows.map((row) => [row.documentNo, row.date, row.plant?.name ?? "", row.product?.name ?? "", row.dispatchWeight, row.totalQuantity, row.receivedQuantity, row.remainingQuantity, row.unit, row.status, row.saleStatus, row.amount, row.loadWeight, row.finalRate, row.remarks]));
}

export async function getLicenseDetailReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.driver.findMany({ where: { companyId: context.companyId, id: filters.driverId, licenseNo: { not: null }, createdAt: { gte: from, lte: to } }, orderBy: { name: "asc" }, select: { id: true, name: true, cell: true, cnic: true, licenseNo: true, licenseClass: true, licenseIssued: true, licenseExpiry: true, status: true, createdAt: true, transporter: { select: { code: true, name: true } } } });
    return { rows: rows.map((row) => ({ id: row.id, party: row.name, cell: row.cell ?? "", cnic: row.cnic ?? "", licenseNo: row.licenseNo ?? "", licenseClass: row.licenseClass ?? "", licenseIssued: row.licenseIssued?.toISOString().slice(0, 10) ?? "", licenseExpiry: row.licenseExpiry?.toISOString().slice(0, 10) ?? "", transporter: row.transporter?.name ?? "", status: row.status, registeredDate: row.createdAt.toISOString().slice(0, 10) })) };
  });
}

export async function getLicenseDetailReportCsv(context: Context, filters: Filters = {}) { const report = await getLicenseDetailReport(context, filters); return csv(["Party", "Cell", "CNIC", "License No", "License Class", "License Issued", "License Expiry", "Transporter", "Status", "Registered Date"], report.rows.map((row) => [row.party, row.cell, row.cnic, row.licenseNo, row.licenseClass, row.licenseIssued, row.licenseExpiry, row.transporter, row.status, row.registeredDate])); }
