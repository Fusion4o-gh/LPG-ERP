import { PermissionAction, Prisma, StockDirection } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Filters = { from?: string; to?: string; productId?: string; locationId?: string; inTransit?: string; importType?: "TAFTAN" | "SHIP" };

function date(value: string | undefined, field: string) {
  if (!value) return undefined;
  const result = new Date(value);
  if (Number.isNaN(result.valueOf())) throw new Error(`${field} is invalid.`);
  return result;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function getBulkStockLedgerReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const from = date(filters.from, "from");
    const to = date(filters.to, "to");
    const rows = await tx.bulkStockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.inTransit === "true" ? { inTransit: true } : filters.inTransit === "false" ? { inTransit: false } : {}),
        transactionDate: { gte: from, lte: to },
      },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
      take: 10000,
    });
    const [products, locations] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.productId))] } }, select: { id: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.locationId))] } }, select: { id: true, name: true } }),
    ]);
    const productNames = new Map(products.map((row) => [row.id, row.name]));
    const locationNames = new Map(locations.map((row) => [row.id, row.name]));
    return {
      rows: rows.map((row) => ({
        id: row.id,
        transactionDate: row.transactionDate.toISOString().slice(0, 10),
        productName: productNames.get(row.productId) ?? row.productId,
        locationName: locationNames.get(row.locationId) ?? row.locationId,
        direction: row.direction,
        quantity: row.quantity.toString(),
        signedQuantity: row.direction === StockDirection.IN ? row.quantity.toString() : row.quantity.negated().toString(),
        balanceAfter: row.balanceAfter.toString(),
        inTransit: row.inTransit,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        remarks: row.remarks,
      })),
    };
  });
}

export async function getBulkStockLedgerReportCsv(context: Context, filters: Filters = {}) {
  const report = await getBulkStockLedgerReport(context, filters);
  const header = ["Date", "Product", "Location", "Direction", "Quantity", "Signed Quantity", "Balance", "In Transit", "Source", "Remarks"];
  const lines = report.rows.map((row) => [row.transactionDate, row.productName, row.locationName, row.direction, row.quantity, row.signedQuantity, row.balanceAfter, row.inTransit, row.sourceType, row.remarks ?? ""].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

function decimalString(value: Prisma.Decimal) {
  return value.toString();
}

function bulkDateRange(filters: Filters) {
  const from = date(filters.from, "from");
  const to = date(filters.to, "to");
  if (from && to && from > to) throw new Error("from must be before or equal to to.");
  return { from, to };
}

export async function getQuantitativeReconciliationReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = bulkDateRange(filters);
    const entries = await tx.bulkStockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        transactionDate: { ...(to ? { lte: to } : {}), ...(from ? {} : {}) },
      },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    });
    const productIds = [...new Set(entries.map((row) => row.productId))];
    const locationIds = [...new Set(entries.map((row) => row.locationId))];
    const [products, locations] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: locationIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const productById = new Map(products.map((row) => [row.id, row]));
    const locationById = new Map(locations.map((row) => [row.id, row]));
    const zero = new Prisma.Decimal(0);
    const byKey = new Map<string, { productId: string; locationId: string; opening: Prisma.Decimal; received: Prisma.Decimal; issued: Prisma.Decimal; inTransit: Prisma.Decimal }>();
    for (const entry of entries) {
      const key = `${entry.productId}|${entry.locationId}`;
      const current = byKey.get(key) ?? { productId: entry.productId, locationId: entry.locationId, opening: zero, received: zero, issued: zero, inTransit: zero };
      const isOpening = Boolean(from && entry.transactionDate < from);
      const signed = entry.direction === StockDirection.IN ? entry.quantity : entry.quantity.negated();
      if (entry.inTransit) current.inTransit = current.inTransit.plus(signed);
      else if (isOpening) current.opening = current.opening.plus(signed);
      else if (entry.direction === StockDirection.IN) current.received = current.received.plus(entry.quantity);
      else current.issued = current.issued.plus(entry.quantity);
      byKey.set(key, current);
    }
    return {
      rows: [...byKey.values()].map((row) => ({
        id: `${row.productId}-${row.locationId}`,
        product: productById.get(row.productId),
        location: locationById.get(row.locationId),
        openingQuantity: decimalString(row.opening),
        receivedQuantity: decimalString(row.received),
        issuedQuantity: decimalString(row.issued),
        closingQuantity: decimalString(row.opening.plus(row.received).minus(row.issued)),
        inTransitQuantity: decimalString(row.inTransit),
      })).sort((a, b) => `${a.product?.code ?? ""}-${a.location?.code ?? ""}`.localeCompare(`${b.product?.code ?? ""}-${b.location?.code ?? ""}`)),
    };
  });
}

export async function getQuantitativeReconciliationReportCsv(context: Context, filters: Filters = {}) {
  const report = await getQuantitativeReconciliationReport(context, filters);
  const header = ["Product Code", "Product", "Location", "Opening", "Received", "Issued", "Closing", "In Transit"];
  const lines = report.rows.map((row) => [row.product?.code ?? "", row.product?.name ?? "", row.location?.name ?? "", row.openingQuantity, row.receivedQuantity, row.issuedQuantity, row.closingQuantity, row.inTransitQuantity].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function getConsumptionReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = bulkDateRange(filters);
    const rows = await tx.bulkStockLedgerEntry.findMany({
      where: {
        companyId: context.companyId,
        direction: StockDirection.OUT,
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.inTransit === "true" ? { inTransit: true } : filters.inTransit === "false" ? { inTransit: false } : { inTransit: false }),
        transactionDate: { gte: from, lte: to },
      },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    });
    const [products, locations] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.productId))] } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.locationId))] } }, select: { id: true, code: true, name: true } }),
    ]);
    const productById = new Map(products.map((row) => [row.id, row]));
    const locationById = new Map(locations.map((row) => [row.id, row]));
    const grouped = new Map<string, { productId: string; locationId: string; sourceType: string; quantity: Prisma.Decimal; count: number }>();
    for (const row of rows) {
      const key = `${row.productId}|${row.locationId}|${row.sourceType}`;
      const current = grouped.get(key) ?? { productId: row.productId, locationId: row.locationId, sourceType: row.sourceType, quantity: new Prisma.Decimal(0), count: 0 };
      current.quantity = current.quantity.plus(row.quantity);
      current.count += 1;
      grouped.set(key, current);
    }
    return {
      rows: [...grouped.values()].map((row) => ({
        id: `${row.productId}-${row.locationId}-${row.sourceType}`,
        product: productById.get(row.productId),
        location: locationById.get(row.locationId),
        sourceType: row.sourceType,
        quantityConsumed: decimalString(row.quantity),
        transactionCount: row.count,
      })).sort((a, b) => `${a.product?.code ?? ""}-${a.sourceType}`.localeCompare(`${b.product?.code ?? ""}-${b.sourceType}`)),
    };
  });
}

export async function getConsumptionReportCsv(context: Context, filters: Filters = {}) {
  const report = await getConsumptionReport(context, filters);
  const header = ["Product Code", "Product", "Location", "Source Type", "Quantity Consumed", "Transactions"];
  const lines = report.rows.map((row) => [row.product?.code ?? "", row.product?.name ?? "", row.location?.name ?? "", row.sourceType, row.quantityConsumed, row.transactionCount].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function getAllContractSummary(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "import-contracts", PermissionAction.VIEW);
    const [imports, purchases, sales] = await Promise.all([
      tx.importContract.findMany({ where: { companyId: context.companyId }, orderBy: { contractDate: "desc" }, take: 500 }),
      tx.purchaseContract.findMany({ where: { companyId: context.companyId }, orderBy: { contractDate: "desc" }, take: 500 }),
      tx.saleContract.findMany({ where: { companyId: context.companyId }, orderBy: { contractDate: "desc" }, take: 500 }),
    ]);
    return {
      rows: [...imports.map((row) => ({ contractNo: row.contractNo, contractDate: row.contractDate.toISOString().slice(0, 10), contractType: `IMPORT_${row.importType}`, partyId: row.vendorId, productId: row.productId, quantity: row.quantity.toString(), deliveredQuantity: null, amount: row.amountPkr.toString(), status: row.status })), ...purchases.map((row) => ({ contractNo: row.contractNo, contractDate: row.contractDate.toISOString().slice(0, 10), contractType: "PURCHASE", partyId: row.vendorId, productId: row.productId, quantity: row.quantity.toString(), deliveredQuantity: row.deliveredQty.toString(), amount: row.amountPkr.toString(), status: row.status })), ...sales.map((row) => ({ contractNo: row.contractNo, contractDate: row.contractDate.toISOString().slice(0, 10), contractType: "SALE", partyId: row.customerId, productId: row.productId, quantity: row.quantity.toString(), deliveredQuantity: row.deliveredQty.toString(), amount: row.amount.toString(), status: row.saleStatus }))].sort((a, b) => b.contractDate.localeCompare(a.contractDate)),
    };
  });
}

export async function getAllContractSummaryCsv(context: Context) {
  const report = await getAllContractSummary(context);
  const header = ["Contract No", "Date", "Type", "Quantity", "Delivered", "Amount", "Status"];
  const lines = report.rows.map((row) => [row.contractNo, row.contractDate, row.contractType, row.quantity, row.deliveredQuantity ?? "", row.amount, row.status].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function getImportContractSummary(context: Context, importType?: "TAFTAN" | "SHIP") {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "import-contracts", PermissionAction.VIEW);
    const contracts = await tx.importContract.findMany({ where: { companyId: context.companyId, ...(importType ? { importType } : {}) }, orderBy: { contractDate: "desc" }, take: 1000 });
    const loadings = await tx.loading.findMany({ where: { companyId: context.companyId, contractId: { in: contracts.map((row) => row.id) } }, select: { contractId: true, quantityLoaded: true, arrivedQuantity: true } });
    const loaded = new Map<string, Prisma.Decimal>(); const arrived = new Map<string, Prisma.Decimal>();
    for (const row of loadings) { loaded.set(row.contractId, (loaded.get(row.contractId) ?? new Prisma.Decimal(0)).plus(row.quantityLoaded)); arrived.set(row.contractId, (arrived.get(row.contractId) ?? new Prisma.Decimal(0)).plus(row.arrivedQuantity ?? 0)); }
    return { rows: contracts.map((row) => ({ contractNo: row.contractNo, contractDate: row.contractDate.toISOString().slice(0, 10), importType: row.importType, quantity: row.quantity.toString(), loadedQuantity: (loaded.get(row.id) ?? new Prisma.Decimal(0)).toString(), arrivedQuantity: (arrived.get(row.id) ?? new Prisma.Decimal(0)).toString(), remainingQuantity: row.quantity.minus(loaded.get(row.id) ?? 0).toString(), status: row.status, amountUsd: row.amountUsd.toString(), amountPkr: row.amountPkr.toString() })) };
  });
}

export async function getImportContractSummaryCsv(context: Context, importType?: "TAFTAN" | "SHIP") {
  const report = await getImportContractSummary(context, importType);
  const header = ["Contract No", "Date", "Import Type", "Quantity", "Loaded", "Arrived", "Remaining", "Status", "USD Amount", "PKR Amount"];
  const lines = report.rows.map((row) => [row.contractNo, row.contractDate, row.importType, row.quantity, row.loadedQuantity, row.arrivedQuantity, row.remainingQuantity, row.status, row.amountUsd, row.amountPkr].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function getTaftanImportRegisterReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const from = date(filters.from, "from"); const to = date(filters.to, "to");
    const rows = await tx.loading.findMany({ where: { companyId: context.companyId, loadingType: "TAFTAN", ...(filters.productId ? { contract: { productId: filters.productId } } : {}), ...(filters.locationId ? { stockLocationId: filters.locationId } : {}), loadingDate: { gte: from, lte: to } }, include: { contract: { select: { contractNo: true, productId: true, vendorId: true, rateUsd: true, exchangeRate: true } } }, orderBy: [{ loadingDate: "asc" }, { loadingNo: "asc" }] });
    const productIds = [...new Set(rows.map((row) => row.contract.productId))]; const vendorIds = [...new Set(rows.map((row) => row.contract.vendorId))];
    const [products, vendors, locations] = await Promise.all([
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.vendor.findMany({ where: { companyId: context.companyId, id: { in: vendorIds } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: rows.flatMap((row) => row.stockLocationId ? [row.stockLocationId] : []) } }, select: { id: true, code: true, name: true } }),
    ]);
    const productById = new Map(products.map((row) => [row.id, row])); const vendorById = new Map(vendors.map((row) => [row.id, row])); const locationById = new Map(locations.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, loadingNo: row.loadingNo, loadingDate: row.loadingDate.toISOString().slice(0, 10), contractNo: row.contract.contractNo, vendor: vendorById.get(row.contract.vendorId), product: productById.get(row.contract.productId), location: row.stockLocationId ? locationById.get(row.stockLocationId) : undefined, quantityLoaded: row.quantityLoaded.toString(), arrivedQuantity: (row.arrivedQuantity ?? 0).toString(), rate: row.rate.toString(), freight: row.freight.toString(), finalRate: row.finalRate.toString(), totalCost: row.finalRate.times(row.quantityLoaded).toString(), exchangeRate: row.contract.exchangeRate.toString(), shipmentStatus: row.shipmentStatus })) };
  });
}

export async function getTaftanImportRegisterReportCsv(context: Context, filters: Filters = {}) { const report = await getTaftanImportRegisterReport(context, filters); return ["Loading No,Date,Contract No,Vendor,Product,Location,Loaded Qty,Arrived Qty,Rate,Freight,Final Rate,Total Cost,Exchange Rate,Status", ...report.rows.map((row) => [row.loadingNo, row.loadingDate, row.contractNo, row.vendor?.name ?? "", row.product?.name ?? "", row.location?.name ?? "", row.quantityLoaded, row.arrivedQuantity, row.rate, row.freight, row.finalRate, row.totalCost, row.exchangeRate, row.shipmentStatus].map(csvCell).join(","))].join("\n"); }

export async function getTaftanPurchaseSaleReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = bulkDateRange(filters);
    const loadings = await tx.loading.findMany({ where: { companyId: context.companyId, loadingType: "TAFTAN", ...(filters.productId ? { contract: { productId: filters.productId } } : {}), ...(filters.locationId ? { stockLocationId: filters.locationId } : {}), loadingDate: { gte: from, lte: to } }, include: { contract: { select: { productId: true } } } });
    const keys = [...new Set(loadings.filter((row) => row.stockLocationId).map((row) => `${row.contract.productId}|${row.stockLocationId}`))];
    const productIds = [...new Set(loadings.map((row) => row.contract.productId))]; const locationIds = [...new Set(loadings.map((row) => row.stockLocationId).filter((id): id is string => Boolean(id)))];
    const outbound = await tx.bulkStockLedgerEntry.findMany({ where: { companyId: context.companyId, productId: { in: productIds }, locationId: { in: locationIds }, direction: "OUT", transactionDate: { gte: from, lte: to } }, select: { productId: true, locationId: true, quantity: true, sourceType: true } });
    const byKey = new Map<string, { productId: string; locationId: string; purchased: Prisma.Decimal; arrived: Prisma.Decimal; sold: Prisma.Decimal }>();
    for (const row of loadings) { if (!row.stockLocationId) continue; const key = `${row.contract.productId}|${row.stockLocationId}`; const current = byKey.get(key) ?? { productId: row.contract.productId, locationId: row.stockLocationId, purchased: new Prisma.Decimal(0), arrived: new Prisma.Decimal(0), sold: new Prisma.Decimal(0) }; current.purchased = current.purchased.plus(row.quantityLoaded); current.arrived = current.arrived.plus(row.arrivedQuantity ?? 0); byKey.set(key, current); }
    for (const row of outbound) { const key = `${row.productId}|${row.locationId}`; const current = byKey.get(key); if (current && row.sourceType !== "IMPORT_ARRIVAL") current.sold = current.sold.plus(row.quantity); }
    const [products, locations] = await Promise.all([tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }), tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: locationIds } }, select: { id: true, code: true, name: true } })]);
    const pm = new Map(products.map((row) => [row.id, row])); const lm = new Map(locations.map((row) => [row.id, row]));
    return { rows: [...byKey.values()].filter((row) => keys.includes(`${row.productId}|${row.locationId}`)).map((row) => ({ id: `${row.productId}-${row.locationId}`, product: pm.get(row.productId), location: lm.get(row.locationId), purchasedQuantity: row.purchased.toString(), arrivedQuantity: row.arrived.toString(), soldQuantity: row.sold.toString(), balanceQuantity: row.arrived.minus(row.sold).toString() })) };
  });
}

export async function getTaftanPurchaseSaleReportCsv(context: Context, filters: Filters = {}) { const report = await getTaftanPurchaseSaleReport(context, filters); return ["Product Code,Product,Location,Purchased,Arrived,Sold,Balance", ...report.rows.map((row) => [row.product?.code ?? "", row.product?.name ?? "", row.location?.name ?? "", row.purchasedQuantity, row.arrivedQuantity, row.soldQuantity, row.balanceQuantity].map(csvCell).join(","))].join("\n"); }

export async function getLoadingReport(context: Context, inTransitOnly = false) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "loadings", PermissionAction.VIEW);
    const rows = await tx.loading.findMany({ where: { companyId: context.companyId, ...(inTransitOnly ? { shipmentStatus: { in: ["IN_TRANSIT", "ARRIVED"] } } : {}) }, include: { contract: { select: { contractNo: true, importType: true, productId: true } } }, orderBy: [{ loadingDate: "desc" }, { loadingNo: "desc" }], take: 2000 });
    const [products, locations] = await Promise.all([tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.contract.productId))] } }, select: { id: true, name: true } }), tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: rows.flatMap((row) => row.stockLocationId ? [row.stockLocationId] : []) } }, select: { id: true, name: true } })]);
    const productNames = new Map(products.map((row) => [row.id, row.name])); const locationNames = new Map(locations.map((row) => [row.id, row.name]));
    return { rows: rows.map((row) => ({ loadingNo: row.loadingNo, loadingDate: row.loadingDate.toISOString().slice(0, 10), contractNo: row.contract.contractNo, importType: row.contract.importType, productName: productNames.get(row.contract.productId) ?? row.contract.productId, quantityLoaded: row.quantityLoaded.toString(), arrivedQuantity: row.arrivedQuantity?.toString() ?? "0", remainingQuantity: row.quantityLoaded.minus(row.arrivedQuantity ?? 0).toString(), shipmentStatus: row.shipmentStatus, locationName: row.stockLocationId ? locationNames.get(row.stockLocationId) ?? row.stockLocationId : "" })) };
  });
}

export async function getLoadingReportCsv(context: Context, inTransitOnly = false) {
  const report = await getLoadingReport(context, inTransitOnly);
  const header = ["Loading No", "Date", "Contract No", "Import Type", "Product", "Loaded", "Arrived", "Remaining", "Status", "Location"];
  const lines = report.rows.map((row) => [row.loadingNo, row.loadingDate, row.contractNo, row.importType, row.productName, row.quantityLoaded, row.arrivedQuantity, row.remainingQuantity, row.shipmentStatus, row.locationName].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function getCmrDifferenceReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = bulkDateRange(filters);
    const rows = await tx.loading.findMany({
      where: {
        companyId: context.companyId,
        ...(filters.productId ? { contract: { productId: filters.productId } } : {}),
        ...(filters.importType ? { loadingType: filters.importType } : {}),
        loadingDate: { gte: from, lte: to },
      },
      include: { contract: { select: { contractNo: true, importType: true, productId: true } } },
      orderBy: [{ loadingDate: "asc" }, { loadingNo: "asc" }],
    });
    const products = await tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.contract.productId))] } }, select: { id: true, code: true, name: true } });
    const productById = new Map(products.map((row) => [row.id, row]));
    return {
      rows: rows.map((row) => {
        const loaded = row.quantityLoaded;
        const arrived = row.arrivedQuantity ?? new Prisma.Decimal(0);
        return {
          id: row.id,
          loadingNo: row.loadingNo,
          loadingDate: row.loadingDate.toISOString().slice(0, 10),
          contractNo: row.contract.contractNo,
          importType: row.contract.importType,
          product: productById.get(row.contract.productId),
          quantityLoaded: loaded.toString(),
          cmrQuantity: arrived.toString(),
          difference: arrived.minus(loaded).toString(),
          shipmentStatus: row.shipmentStatus,
        };
      }),
    };
  });
}

export async function getCmrDifferenceReportCsv(context: Context, filters: Filters = {}) {
  const report = await getCmrDifferenceReport(context, filters);
  const header = ["Loading No", "Date", "Contract No", "Import Type", "Product", "Loaded Quantity", "CMR Quantity", "Difference", "Status"];
  const lines = report.rows.map((row) => [row.loadingNo, row.loadingDate, row.contractNo, row.importType, row.product?.name ?? "", row.quantityLoaded, row.cmrQuantity, row.difference, row.shipmentStatus].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function getImportCostSheetReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = bulkDateRange(filters);
    const rows = await tx.loading.findMany({
      where: {
        companyId: context.companyId,
        ...(filters.productId ? { contract: { productId: filters.productId } } : {}),
        ...(filters.importType ? { loadingType: filters.importType } : {}),
        loadingDate: { gte: from, lte: to },
      },
      include: { contract: { select: { contractNo: true, importType: true, productId: true, rateUsd: true, exchangeRate: true } } },
      orderBy: [{ loadingDate: "asc" }, { loadingNo: "asc" }],
    });
    const products = await tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(rows.map((row) => row.contract.productId))] } }, select: { id: true, code: true, name: true } });
    const productById = new Map(products.map((row) => [row.id, row]));
    return {
      rows: rows.map((row) => {
        const quantity = row.quantityLoaded;
        const arrived = row.arrivedQuantity ?? new Prisma.Decimal(0);
        return {
          id: row.id,
          loadingNo: row.loadingNo,
          loadingDate: row.loadingDate.toISOString().slice(0, 10),
          contractNo: row.contract.contractNo,
          importType: row.contract.importType,
          product: productById.get(row.contract.productId),
          quantityLoaded: quantity.toString(),
          arrivedQuantity: arrived.toString(),
          rate: row.rate.toString(),
          freight: row.freight.toString(),
          finalRate: row.finalRate.toString(),
          totalFreight: row.freight.times(quantity).toString(),
          totalCost: row.finalRate.times(quantity).toString(),
          arrivedCost: row.finalRate.times(arrived).toString(),
          contractRateUsd: row.contract.rateUsd.toString(),
          exchangeRate: row.contract.exchangeRate.toString(),
        };
      }),
    };
  });
}

export async function getImportCostSheetReportCsv(context: Context, filters: Filters = {}) {
  const report = await getImportCostSheetReport(context, filters);
  const header = ["Loading No", "Date", "Contract No", "Import Type", "Product", "Loaded Qty", "Arrived Qty", "Rate", "Freight", "Final Rate", "Total Freight", "Total Cost", "Arrived Cost", "Contract USD Rate", "Exchange Rate"];
  const lines = report.rows.map((row) => [row.loadingNo, row.loadingDate, row.contractNo, row.importType, row.product?.name ?? "", row.quantityLoaded, row.arrivedQuantity, row.rate, row.freight, row.finalRate, row.totalFreight, row.totalCost, row.arrivedCost, row.contractRateUsd, row.exchangeRate].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}
