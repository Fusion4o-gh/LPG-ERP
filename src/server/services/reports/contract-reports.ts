import { PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Filters = { from?: string; to?: string; vendorId?: string; customerId?: string; productId?: string; locationId?: string };

function date(value: string | undefined, field: string) { if (!value) return undefined; const parsed = new Date(value); if (Number.isNaN(parsed.valueOf())) throw new Error(`${field} is invalid.`); return parsed; }
function range(filters: Filters) { const from = date(filters.from, "from"); const to = date(filters.to, "to"); if (from && to && from > to) throw new Error("from must be before or equal to to."); return { from, to }; }
function cell(value: unknown) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function csv(headers: string[], rows: unknown[][]) { return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\n"); }

export async function getLocalPurchaseDetailReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.localPurchase.findMany({ where: { companyId: context.companyId, vendorId: filters.vendorId, productId: filters.productId, locationId: filters.locationId, transactionDate: { gte: from, lte: to } }, include: { contract: { select: { contractNo: true } } }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }] });
    const vendorIds = [...new Set(rows.map((row) => row.vendorId))]; const productIds = [...new Set(rows.map((row) => row.productId))]; const locationIds = [...new Set(rows.map((row) => row.locationId))];
    const [vendors, products, locations] = await Promise.all([
      tx.vendor.findMany({ where: { companyId: context.companyId, id: { in: vendorIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
      tx.stockLocation.findMany({ where: { companyId: context.companyId, id: { in: locationIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const vm = new Map(vendors.map((row) => [row.id, row])); const pm = new Map(products.map((row) => [row.id, row])); const lm = new Map(locations.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, documentNo: row.documentNo, date: row.transactionDate.toISOString().slice(0, 10), contractNo: row.contract?.contractNo ?? "", vendor: vm.get(row.vendorId), product: pm.get(row.productId), location: lm.get(row.locationId), quantity: row.quantity.toString(), unit: row.unit, rate: row.rate.toString(), amount: row.amount.toString(), remarks: row.remarks ?? "" })) };
  });
}

export async function getLocalPurchaseDetailReportCsv(context: Context, filters: Filters = {}) { const report = await getLocalPurchaseDetailReport(context, filters); return csv(["Document No", "Date", "Contract No", "Vendor", "Product", "Location", "Quantity", "Unit", "Rate", "Amount", "Remarks"], report.rows.map((row) => [row.documentNo, row.date, row.contractNo, row.vendor?.name ?? "", row.product?.name ?? "", row.location?.name ?? "", row.quantity, row.unit, row.rate, row.amount, row.remarks])); }

export async function getLocalPurchaseSummaryReport(context: Context, filters: Filters = {}) {
  const detail = await getLocalPurchaseDetailReport(context, filters);
  const grouped = new Map<string, { vendor: typeof detail.rows[number]["vendor"]; product: typeof detail.rows[number]["product"]; quantity: Prisma.Decimal; amount: Prisma.Decimal; transactions: number }>();
  for (const row of detail.rows) { const key = `${row.vendor?.id ?? ""}|${row.product?.id ?? ""}`; const current = grouped.get(key) ?? { vendor: row.vendor, product: row.product, quantity: new Prisma.Decimal(0), amount: new Prisma.Decimal(0), transactions: 0 }; current.quantity = current.quantity.plus(row.quantity); current.amount = current.amount.plus(row.amount); current.transactions += 1; grouped.set(key, current); }
  return { rows: [...grouped.values()].map((row) => ({ id: `${row.vendor?.id ?? ""}-${row.product?.id ?? ""}`, vendor: row.vendor, product: row.product, quantity: row.quantity.toString(), amount: row.amount.toString(), transactions: row.transactions })) };
}

export async function getLocalPurchaseSummaryReportCsv(context: Context, filters: Filters = {}) { const report = await getLocalPurchaseSummaryReport(context, filters); return csv(["Vendor", "Product", "Quantity", "Amount", "Transactions"], report.rows.map((row) => [row.vendor?.name ?? "", row.product?.name ?? "", row.quantity, row.amount, row.transactions])); }

export async function getContractPurchaseSaleReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters); const dateWhere = { gte: from, lte: to };
    const [imports, purchases, sales] = await Promise.all([
      tx.importContract.findMany({ where: { companyId: context.companyId, vendorId: filters.vendorId, productId: filters.productId, contractDate: dateWhere } }),
      tx.purchaseContract.findMany({ where: { companyId: context.companyId, vendorId: filters.vendorId, productId: filters.productId, contractDate: dateWhere } }),
      tx.saleContract.findMany({ where: { companyId: context.companyId, customerId: filters.customerId, productId: filters.productId, contractDate: dateWhere } }),
    ]);
    const vendorIds = [...new Set([...imports, ...purchases].map((row) => row.vendorId))]; const customerIds = [...new Set(sales.map((row) => row.customerId))]; const productIds = [...new Set([...imports, ...purchases, ...sales].map((row) => row.productId))];
    const [vendors, customers, products] = await Promise.all([
      tx.vendor.findMany({ where: { companyId: context.companyId, id: { in: vendorIds } }, select: { id: true, code: true, name: true } }),
      tx.customer.findMany({ where: { companyId: context.companyId, id: { in: customerIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const vm = new Map(vendors.map((row) => [row.id, row])); const cm = new Map(customers.map((row) => [row.id, row])); const pm = new Map(products.map((row) => [row.id, row]));
    return { rows: [
      ...imports.map((row) => ({ id: row.id, contractNo: row.contractNo, date: row.contractDate.toISOString().slice(0, 10), contractType: `IMPORT_${row.importType}`, vendor: vm.get(row.vendorId), customer: undefined, product: pm.get(row.productId), quantity: row.quantity.toString(), deliveredQuantity: null, amount: row.amountPkr.toString(), status: row.status })),
      ...purchases.map((row) => ({ id: row.id, contractNo: row.contractNo, date: row.contractDate.toISOString().slice(0, 10), contractType: "LOCAL_PURCHASE", vendor: vm.get(row.vendorId), customer: undefined, product: pm.get(row.productId), quantity: row.quantity.toString(), deliveredQuantity: row.deliveredQty.toString(), amount: row.amountPkr.toString(), status: row.status })),
      ...sales.map((row) => ({ id: row.id, contractNo: row.contractNo, date: row.contractDate.toISOString().slice(0, 10), contractType: "SALE", vendor: undefined, customer: cm.get(row.customerId), product: pm.get(row.productId), quantity: row.quantity.toString(), deliveredQuantity: row.deliveredQty.toString(), amount: row.amount.toString(), status: row.saleStatus })),
    ].sort((a, b) => b.date.localeCompare(a.date)) };
  });
}

export async function getContractPurchaseSaleReportCsv(context: Context, filters: Filters = {}) { const report = await getContractPurchaseSaleReport(context, filters); return csv(["Contract No", "Date", "Type", "Vendor", "Customer", "Product", "Quantity", "Delivered", "Amount", "Status"], report.rows.map((row) => [row.contractNo, row.date, row.contractType, row.vendor?.name ?? "", row.customer?.name ?? "", row.product?.name ?? "", row.quantity, row.deliveredQuantity, row.amount, row.status])); }

export async function getSaleContractSummaryReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.saleContract.findMany({ where: { companyId: context.companyId, customerId: filters.customerId, productId: filters.productId, contractDate: { gte: from, lte: to } }, orderBy: [{ contractDate: "asc" }, { contractNo: "asc" }] });
    const customerIds = [...new Set(rows.map((row) => row.customerId))]; const productIds = [...new Set(rows.map((row) => row.productId))];
    const [customers, products] = await Promise.all([
      tx.customer.findMany({ where: { companyId: context.companyId, id: { in: customerIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const customerById = new Map(customers.map((row) => [row.id, row])); const productById = new Map(products.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, contractNo: row.contractNo, date: row.contractDate.toISOString().slice(0, 10), customer: customerById.get(row.customerId), product: productById.get(row.productId), quantity: row.quantity.toString(), deliveredQuantity: row.deliveredQty.toString(), remainingQuantity: row.quantity.minus(row.deliveredQty).toString(), unit: row.unit, rate: row.rate.toString(), amount: row.amount.toString(), contractStatus: row.contractStatus, saleStatus: row.saleStatus, deliveryLocation: row.deliveryLocation ?? "", numberOfBowsers: row.numberOfBowsers ?? "" })) };
  });
}

export async function getSaleContractSummaryReportCsv(context: Context, filters: Filters = {}) { const report = await getSaleContractSummaryReport(context, filters); return csv(["Contract No", "Date", "Customer", "Product", "Quantity", "Delivered", "Remaining", "Unit", "Rate", "Amount", "Contract Status", "Sale Status", "Delivery Location", "Bowsers"], report.rows.map((row) => [row.contractNo, row.date, row.customer?.name ?? "", row.product?.name ?? "", row.quantity, row.deliveredQuantity, row.remainingQuantity, row.unit, row.rate, row.amount, row.contractStatus, row.saleStatus, row.deliveryLocation, row.numberOfBowsers])); }

export async function getSaleContractDollarSummaryReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "reports", PermissionAction.VIEW);
    const { from, to } = range(filters);
    const rows = await tx.saleContract.findMany({ where: { companyId: context.companyId, isDollar: true, customerId: filters.customerId, productId: filters.productId, contractDate: { gte: from, lte: to } }, orderBy: [{ contractDate: "asc" }, { contractNo: "asc" }] });
    const customerIds = [...new Set(rows.map((row) => row.customerId))];
    const productIds = [...new Set(rows.map((row) => row.productId))];
    const [customers, products] = await Promise.all([
      tx.customer.findMany({ where: { companyId: context.companyId, id: { in: customerIds } }, select: { id: true, code: true, name: true } }),
      tx.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: productIds } }, select: { id: true, code: true, name: true } }),
    ]);
    const customerById = new Map(customers.map((row) => [row.id, row]));
    const productById = new Map(products.map((row) => [row.id, row]));
    return { rows: rows.map((row) => ({ id: row.id, contractNo: row.contractNo, date: row.contractDate.toISOString().slice(0, 10), customer: customerById.get(row.customerId), product: productById.get(row.productId), quantity: row.quantity.toString(), deliveredQuantity: row.deliveredQty.toString(), remainingQuantity: row.quantity.minus(row.deliveredQty).toString(), unit: row.unit, rateUsd: (row.rateUsd ?? 0).toString(), amountUsd: row.rateUsd ? row.rateUsd.times(row.quantity).toString() : "0", contractStatus: row.contractStatus, saleStatus: row.saleStatus, deliveryLocation: row.deliveryLocation ?? "", numberOfBowsers: row.numberOfBowsers ?? "" })) };
  });
}

export async function getSaleContractDollarSummaryReportCsv(context: Context, filters: Filters = {}) { const report = await getSaleContractDollarSummaryReport(context, filters); return csv(["Contract No", "Date", "Customer", "Product", "Quantity", "Delivered", "Remaining", "Unit", "USD Rate", "USD Amount", "Contract Status", "Sale Status", "Delivery Location", "Bowsers"], report.rows.map((row) => [row.contractNo, row.date, row.customer?.name ?? "", row.product?.name ?? "", row.quantity, row.deliveredQuantity, row.remainingQuantity, row.unit, row.rateUsd, row.amountUsd, row.contractStatus, row.saleStatus, row.deliveryLocation, row.numberOfBowsers])); }
