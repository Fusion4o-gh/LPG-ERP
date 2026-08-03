import { DollarTxnType, PermissionAction, Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };
type Filters = { from?: string; to?: string; txnType?: string };
function date(value: string | undefined, field: string) { if (!value) return undefined; const result = new Date(value); if (Number.isNaN(result.valueOf())) throw new Error(`${field} is invalid.`); return result; }
function csvCell(value: unknown) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }

export async function getDollarLedgerReport(context: Context, filters: Filters = {}) {
  return prisma.$transaction(async (tx) => { await enforcePermission(tx, context.userId, "dollar-transactions", PermissionAction.VIEW); const from = date(filters.from, "from"); const to = date(filters.to, "to"); const rows = await tx.dollarTransaction.findMany({ where: { companyId: context.companyId, ...(filters.txnType ? { txnType: filters.txnType as DollarTxnType } : {}), transactionDate: { gte: from, lte: to } }, orderBy: [{ transactionDate: "asc" }, { documentNo: "asc" }], take: 5000 }); return { rows: rows.map((row) => ({ id: row.id, documentNo: row.documentNo, txnType: row.txnType, transactionDate: row.transactionDate.toISOString().slice(0, 10), usdAmount: row.usdAmount.toString(), exchangeRate: row.exchangeRate.toString(), pkrAmount: row.pkrAmount.toString(), exchangeGainLoss: row.exchangeGainLoss.toString(), customerId: row.customerId, vendorId: row.vendorId, remarks: row.remarks })) }; });
}

export async function getDollarLedgerReportCsv(context: Context, filters: Filters = {}) { const report = await getDollarLedgerReport(context, filters); const header = ["Document", "Type", "Date", "USD", "Exchange Rate", "PKR", "Exchange Gain/Loss", "Remarks"]; const lines = report.rows.map((row) => [row.documentNo, row.txnType, row.transactionDate, row.usdAmount, row.exchangeRate, row.pkrAmount, row.exchangeGainLoss, row.remarks ?? ""].map(csvCell).join(",")); return [header.join(","), ...lines].join("\n"); }

export async function getDeliveredSaleDollarReport(context: Context) {
  return getDollarLedgerReport(context, { txnType: "SALE_WITH_CONTRACT" });
}

export async function getDeliveredSaleDollarReportCsv(context: Context) {
  return getDollarLedgerReportCsv(context, { txnType: "SALE_WITH_CONTRACT" });
}

export async function getPlantBulkSaleDollarReport(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "dollar-transactions", PermissionAction.VIEW);
    const rows = await tx.plantSale.findMany({ where: { companyId: context.companyId, saleType: "BULK", isDollar: true }, orderBy: [{ transactionDate: "desc" }, { documentNo: "desc" }], take: 2000 });
    return { rows: rows.map((row) => ({ documentNo: row.documentNo, transactionDate: row.transactionDate.toISOString().slice(0, 10), customerId: row.customerId, quantity: row.quantity.toString(), rate: row.rate.toString(), amount: row.amount.toString(), paymentStatus: row.paymentStatus, remarks: row.remarks })) };
  });
}

export async function getPlantBulkSaleDollarReportCsv(context: Context) {
  const report = await getPlantBulkSaleDollarReport(context);
  const header = ["Document", "Date", "Quantity", "Rate", "Amount", "Payment", "Remarks"];
  const lines = report.rows.map((row) => [row.documentNo, row.transactionDate, row.quantity, row.rate, row.amount, row.paymentStatus ?? "", row.remarks ?? ""].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}
