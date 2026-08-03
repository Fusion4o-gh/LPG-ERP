import { PermissionAction, Prisma, StockDirection } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Filters = { from?: string; to?: string; productId?: string; customerId?: string; vehicleId?: string; transporterId?: string; plantId?: string };

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

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function money(value: Prisma.Decimal | null | undefined) {
  return value?.toString() ?? "0";
}

export async function getRetailSaleRegisterReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const dateWhere = { gte: from, lte: to };
    const [deliveries, plantSales] = await Promise.all([
      tx.saleDelivery.findMany({ where: { companyId: context.companyId, customerId: filters.customerId, productId: filters.productId, vehicleId: filters.vehicleId, transporterId: filters.transporterId, transactionDate: dateWhere }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] }),
      tx.plantSale.findMany({ where: { companyId: context.companyId, customerId: filters.customerId, productId: filters.productId, vehicleId: filters.vehicleId, transporterId: filters.transporterId, transactionDate: dateWhere, saleType: "FILLING" }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] }),
    ]);
    const customerIds = [...new Set([...deliveries, ...plantSales].map((row) => row.customerId))];
    const productIds = [...new Set([...deliveries, ...plantSales].map((row) => row.productId).filter((id): id is string => Boolean(id)))];
    const vehicleIds = [...new Set([...deliveries, ...plantSales].map((row) => row.vehicleId).filter((id): id is string => Boolean(id)))];
    const transporterIds = [...new Set([...deliveries, ...plantSales].map((row) => row.transporterId).filter((id): id is string => Boolean(id)))];
    const [customers, products, vehicles, transporters] = await Promise.all([
      tx.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.vehicle.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, registrationNo: true, bowserCapacity: true, capacityUnit: true } }),
      tx.transporter.findMany({ where: { id: { in: transporterIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const customerById = new Map(customers.map((row) => [row.id, row]));
    const productById = new Map(products.map((row) => [row.id, row]));
    const vehicleById = new Map(vehicles.map((row) => [row.id, row]));
    const transporterById = new Map(transporters.map((row) => [row.id, row]));
    const rows = [
      ...deliveries.map((row) => ({ id: row.id, documentNo: row.documentNo, date: row.transactionDate, saleType: row.contractId ? "Delivered With Contract" : "Delivered Without Contract", customer: customerById.get(row.customerId), product: productById.get(row.productId), vehicle: row.vehicleId ? vehicleById.get(row.vehicleId) : undefined, transporter: row.transporterId ? transporterById.get(row.transporterId) : undefined, quantity: row.quantity.toString(), deliveryWeight: row.deliveryWeight.toString(), loadWeight: row.loadWeight.toString(), rate: row.rate.toString(), finalRate: row.finalRate.toString(), amount: row.amount.toString(), isDollar: row.isDollar })),
      ...plantSales.map((row) => ({ id: row.id, documentNo: row.documentNo, date: row.transactionDate, saleType: "Filling Sale", customer: customerById.get(row.customerId), product: row.productId ? productById.get(row.productId) : undefined, vehicle: row.vehicleId ? vehicleById.get(row.vehicleId) : undefined, transporter: row.transporterId ? transporterById.get(row.transporterId) : undefined, quantity: row.quantity.toString(), deliveryWeight: "0", loadWeight: "0", rate: row.rate.toString(), finalRate: row.rate.toString(), amount: row.amount.toString(), isDollar: row.isDollar })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime() || a.documentNo.localeCompare(b.documentNo));
    return { rows: rows.map((row) => ({ ...row, date: row.date.toISOString().slice(0, 10), vehicleCapacity: row.vehicle?.bowserCapacity?.toString() ?? "", capacityUnit: row.vehicle?.capacityUnit ?? "" })) };
  });
}

export async function getRetailSaleRegisterReportCsv(context: Context, filters: Filters = {}) {
  const report = await getRetailSaleRegisterReport(context, filters);
  return csv(["Document No", "Date", "Sale Type", "Customer", "Product", "Vehicle", "Transporter", "Quantity", "Delivery Weight", "Load Weight", "Rate", "Final Rate", "Amount", "Dollar"], report.rows.map((row) => [row.documentNo, row.date, row.saleType, row.customer?.name ?? "", row.product?.name ?? "", row.vehicle?.registrationNo ?? "", row.transporter?.name ?? "", row.quantity, row.deliveryWeight, row.loadWeight, row.rate, row.finalRate, row.amount, row.isDollar]));
}

export async function getDeliveredSaleReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.saleDelivery.findMany({ where: { companyId: context.companyId, customerId: filters.customerId, productId: filters.productId, vehicleId: filters.vehicleId, transporterId: filters.transporterId, transactionDate: { gte: from, lte: to } }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] });
    const customerIds = [...new Set(rows.map((row) => row.customerId))]; const productIds = [...new Set(rows.map((row) => row.productId))]; const vehicleIds = [...new Set(rows.map((row) => row.vehicleId).filter((id): id is string => Boolean(id)))]; const transporterIds = [...new Set(rows.map((row) => row.transporterId).filter((id): id is string => Boolean(id)))];
    const [customers, products, vehicles, transporters] = await Promise.all([
      tx.customer.findMany({ where: { companyId: context.companyId, id: { in: customerIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.vehicle.findMany({ where: { companyId: context.companyId, id: { in: vehicleIds } }, select: { id: true, registrationNo: true } }),
      tx.transporter.findMany({ where: { companyId: context.companyId, id: { in: transporterIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const cm = new Map(customers.map((row) => [row.id, row])); const pm = new Map(products.map((row) => [row.id, row])); const vm = new Map(vehicles.map((row) => [row.id, row])); const tm = new Map(transporters.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, documentNo: row.documentNo, date: row.transactionDate.toISOString().slice(0, 10), customer: cm.get(row.customerId), product: pm.get(row.productId), vehicle: row.vehicleId ? vm.get(row.vehicleId) : undefined, transporter: row.transporterId ? tm.get(row.transporterId) : undefined, quantity: row.quantity.toString(), deliveryWeight: row.deliveryWeight.toString(), loadWeight: row.loadWeight.toString(), rate: row.rate.toString(), finalRate: row.finalRate.toString(), amount: row.amount.toString(), isDollar: row.isDollar, contractId: row.contractId ?? "", remarks: row.remarks ?? "" })) };
  });
}

export async function getDeliveredSaleReportCsv(context: Context, filters: Filters = {}) { const report = await getDeliveredSaleReport(context, filters); return csv(["Document No", "Date", "Customer", "Product", "Vehicle", "Transporter", "Quantity", "Delivery Weight", "Load Weight", "Rate", "Final Rate", "Amount", "Dollar", "Contract", "Remarks"], report.rows.map((row) => [row.documentNo, row.date, row.customer?.name ?? "", row.product?.name ?? "", row.vehicle?.registrationNo ?? "", row.transporter?.name ?? "", row.quantity, row.deliveryWeight, row.loadWeight, row.rate, row.finalRate, row.amount, row.isDollar, row.contractId, row.remarks])); }

export async function getStockTransitReconcileReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const asOf = date(filters.to, "to");
    const [ledgerRows, loadings] = await Promise.all([
      tx.bulkStockLedgerEntry.findMany({ where: { companyId: context.companyId, inTransit: true, ...(filters.productId ? { productId: filters.productId } : {}), ...(filters.to ? { transactionDate: { lte: asOf } } : {}) }, orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }] }),
      tx.loading.findMany({ where: { companyId: context.companyId, shipmentStatus: { in: ["IN_TRANSIT", "ARRIVED"] }, ...(filters.productId ? { contract: { productId: filters.productId } } : {}), ...(filters.to ? { loadingDate: { lte: asOf } } : {}) }, include: { contract: { select: { productId: true } } } }),
    ]);
    const productIds = [...new Set([...ledgerRows.map((row) => row.productId), ...loadings.map((row) => row.contract.productId)])];
    const locationIds = [...new Set([...ledgerRows.map((row) => row.locationId), ...loadings.map((row) => row.stockLocationId).filter((id): id is string => Boolean(id))])];
    const [products, locations] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: locationIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const productById = new Map(products.map((row) => [row.id, row]));
    const locationById = new Map(locations.map((row) => [row.id, row]));
    const byKey = new Map<string, { productId: string; locationId: string; ledger: Prisma.Decimal; documents: Prisma.Decimal }>();
    for (const row of ledgerRows) {
      const key = `${row.productId}|${row.locationId}`;
      const current = byKey.get(key) ?? { productId: row.productId, locationId: row.locationId, ledger: new Prisma.Decimal(0), documents: new Prisma.Decimal(0) };
      current.ledger = current.ledger.plus(row.direction === StockDirection.IN ? row.quantity : row.quantity.negated());
      byKey.set(key, current);
    }
    for (const row of loadings) {
      if (!row.stockLocationId) continue;
      const key = `${row.contract.productId}|${row.stockLocationId}`;
      const current = byKey.get(key) ?? { productId: row.contract.productId, locationId: row.stockLocationId, ledger: new Prisma.Decimal(0), documents: new Prisma.Decimal(0) };
      current.documents = current.documents.plus(row.quantityLoaded.minus(row.arrivedQuantity ?? 0));
      byKey.set(key, current);
    }
    return { rows: [...byKey.values()].map((row) => ({ id: `${row.productId}-${row.locationId}`, product: productById.get(row.productId), location: locationById.get(row.locationId), ledgerTransit: row.ledger.toString(), documentTransit: row.documents.toString(), difference: row.ledger.minus(row.documents).toString() })).sort((a, b) => `${a.product?.code ?? ""}-${a.location?.code ?? ""}`.localeCompare(`${b.product?.code ?? ""}-${b.location?.code ?? ""}`)) };
  });
}

export async function getStockTransitReconcileReportCsv(context: Context, filters: Filters = {}) {
  const report = await getStockTransitReconcileReport(context, filters);
  return csv(["Product Code", "Product", "Location", "Ledger Transit", "Document Transit", "Difference"], report.rows.map((row) => [row.product?.code ?? "", row.product?.name ?? "", row.location?.name ?? "", row.ledgerTransit, row.documentTransit, row.difference]));
}

export async function getVehicleBowserReport(context: Context, filters: Filters = {}) {
  const report = await getRetailSaleRegisterReport(context, filters);
  const grouped = new Map<string, { vehicleId: string; vehicle: typeof report.rows[number]["vehicle"]; transporter: typeof report.rows[number]["transporter"]; trips: number; quantity: Prisma.Decimal; amount: Prisma.Decimal }>();
  for (const row of report.rows) {
    if (!row.vehicle) continue;
    const current = grouped.get(row.vehicle.registrationNo) ?? { vehicleId: row.vehicle.registrationNo, vehicle: row.vehicle, transporter: row.transporter, trips: 0, quantity: new Prisma.Decimal(0), amount: new Prisma.Decimal(0) };
    current.trips += 1;
    current.quantity = current.quantity.plus(row.quantity);
    current.amount = current.amount.plus(row.amount);
    grouped.set(row.vehicle.registrationNo, current);
  }
  return { rows: [...grouped.values()].map((row) => ({ id: row.vehicleId, vehicle: row.vehicle, transporter: row.transporter, trips: row.trips, quantity: row.quantity.toString(), amount: row.amount.toString() })) };
}

export async function getVehicleBowserReportCsv(context: Context, filters: Filters = {}) {
  const report = await getVehicleBowserReport(context, filters);
  return csv(["Vehicle", "Transporter", "Capacity", "Unit", "Trips", "Quantity", "Amount"], report.rows.map((row) => [row.vehicle?.registrationNo ?? "", row.transporter?.name ?? "", row.vehicle?.bowserCapacity?.toString() ?? "", row.vehicle?.capacityUnit ?? "", row.trips, row.quantity, row.amount]));
}

export async function getPlantBulkSaleReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.plantSale.findMany({ where: { companyId: context.companyId, saleType: "BULK", isDollar: false, plantId: filters.plantId, customerId: filters.customerId, productId: filters.productId, transactionDate: { gte: from, lte: to } }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] });
    const customerIds = [...new Set(rows.map((row) => row.customerId))]; const productIds = [...new Set(rows.map((row) => row.productId).filter((id): id is string => Boolean(id)))]; const plantIds = [...new Set(rows.map((row) => row.plantId))];
    const [customers, products, plants] = await Promise.all([
      tx.customer.findMany({ where: { companyId: context.companyId, id: { in: customerIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.plant.findMany({ where: { companyId: context.companyId, id: { in: plantIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const cm = new Map(customers.map((row) => [row.id, row])); const pm = new Map(products.map((row) => [row.id, row])); const plm = new Map(plants.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, documentNo: row.documentNo, invoiceNo: row.invoiceNo ?? "", date: row.transactionDate.toISOString().slice(0, 10), customer: cm.get(row.customerId), product: row.productId ? pm.get(row.productId) : undefined, plant: plm.get(row.plantId), quantity: row.quantity.toString(), unit: row.unit, rate: row.rate.toString(), amount: row.amount.toString(), paymentStatus: row.paymentStatus ?? "", remarks: row.remarks ?? "" })) };
  });
}

export async function getPlantBulkSaleReportCsv(context: Context, filters: Filters = {}) { const report = await getPlantBulkSaleReport(context, filters); return csv(["Document No", "Invoice No", "Date", "Customer", "Product", "Plant", "Quantity", "Unit", "Rate", "Amount", "Payment", "Remarks"], report.rows.map((row) => [row.documentNo, row.invoiceNo, row.date, row.customer?.name ?? "", row.product?.name ?? "", row.plant?.name ?? "", row.quantity, row.unit, row.rate, row.amount, row.paymentStatus, row.remarks])); }

export async function getVehicleReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const vehicles = await tx.vehicle.findMany({ where: { companyId: context.companyId, id: filters.vehicleId ? filters.vehicleId : undefined }, select: { id: true, registrationNo: true, bowserCapacity: true, capacityUnit: true, status: true, transporter: { select: { id: true, code: true, name: true } }, driver: { select: { id: true, name: true, licenseNo: true } } }, orderBy: { registrationNo: "asc" } });
    const [deliveries, plantSales] = await Promise.all([
      tx.saleDelivery.findMany({ where: { companyId: context.companyId, vehicleId: { in: vehicles.map((row) => row.id) }, transactionDate: { gte: from, lte: to } }, select: { vehicleId: true, quantity: true, amount: true } }),
      tx.plantSale.findMany({ where: { companyId: context.companyId, vehicleId: { in: vehicles.map((row) => row.id) }, transactionDate: { gte: from, lte: to } }, select: { vehicleId: true, quantity: true, amount: true } }),
    ]);
    const byVehicle = new Map<string, { trips: number; quantity: Prisma.Decimal; amount: Prisma.Decimal }>();
    for (const row of [...deliveries, ...plantSales]) { if (!row.vehicleId) continue; const current = byVehicle.get(row.vehicleId) ?? { trips: 0, quantity: new Prisma.Decimal(0), amount: new Prisma.Decimal(0) }; current.trips += 1; current.quantity = current.quantity.plus(row.quantity); current.amount = current.amount.plus(row.amount); byVehicle.set(row.vehicleId, current); }
    return { rows: vehicles.map((vehicle) => { const totals = byVehicle.get(vehicle.id) ?? { trips: 0, quantity: new Prisma.Decimal(0), amount: new Prisma.Decimal(0) }; return { id: vehicle.id, registrationNo: vehicle.registrationNo, bowserCapacity: vehicle.bowserCapacity?.toString() ?? "", capacityUnit: vehicle.capacityUnit, status: vehicle.status, transporter: vehicle.transporter, driver: vehicle.driver, trips: totals.trips, quantity: totals.quantity.toString(), amount: totals.amount.toString() }; }) };
  });
}

export async function getVehicleReportCsv(context: Context, filters: Filters = {}) { const report = await getVehicleReport(context, filters); return csv(["Vehicle", "Capacity", "Unit", "Transporter", "Driver", "License", "Status", "Trips", "Quantity", "Amount"], report.rows.map((row) => [row.registrationNo, row.bowserCapacity, row.capacityUnit, row.transporter?.name ?? "", row.driver?.name ?? "", row.driver?.licenseNo ?? "", row.status, row.trips, row.quantity, row.amount])); }
