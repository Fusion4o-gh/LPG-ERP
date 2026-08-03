import { BulkStockSourceType, PermissionAction, StockSourceType } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { enforcePermission } from "../../../../../server/services/rbac/enforce.ts";

type DocumentConfig = {
  type: string;
  module: string;
  sourceType?: string;
  stockSourceType?: StockSourceType;
  bulkSourceType?: BulkStockSourceType;
  voucherByDocumentNo?: boolean;
};

const documentConfigs: Record<string, DocumentConfig> = {
  "sale-lpg": {
    type: "Sale LPG Invoice",
    module: "sale-lpg",
    sourceType: "SaleLpg",
    stockSourceType: StockSourceType.SALE_LPG,
  },
  "delivery-challan": {
    type: "Delivery Challan",
    module: "delivery-challan",
    sourceType: "DeliveryChallan",
    stockSourceType: StockSourceType.DELIVERY_CHALLAN,
  },
  "purchase-filled-cylinder": {
    type: "Purchase Filled Cylinder Receipt",
    module: "purchase-filled-cylinders",
    sourceType: "PurchaseFilledCylinder",
    stockSourceType: StockSourceType.PURCHASE_FILLED,
  },
  "purchase-empty-cylinder": {
    type: "Purchase Empty Cylinder Receipt",
    module: "purchase-filled-cylinders",
    sourceType: "PurchaseEmptyCylinder",
    stockSourceType: StockSourceType.PURCHASE_FILLED,
  },
  "purchase-other": {
    type: "Purchase Other Receipt",
    module: "purchase-filled-cylinders",
    sourceType: "PurchaseOther",
    stockSourceType: StockSourceType.PURCHASE_FILLED,
  },
  "cylinder-return": {
    type: "Cylinder Return Receipt",
    module: "cylinder-returns",
    sourceType: "CylinderReturn",
    stockSourceType: StockSourceType.CYLINDER_RETURN,
  },
  "cylinder-conversion": {
    type: "Cylinder Conversion Document",
    module: "cylinder-conversions",
    sourceType: "CylinderConversion",
    stockSourceType: StockSourceType.ADJUSTMENT,
  },
  "empty-sale": {
    type: "Empty Sale Invoice",
    module: "empty-sales",
    sourceType: "EmptySale",
    stockSourceType: StockSourceType.SALE_LPG,
  },
  "decanting-sale": {
    type: "Decanting Sale Document",
    module: "decanting-sales",
    sourceType: "DecantingSale",
    stockSourceType: StockSourceType.SALE_LPG,
  },
  "purchase-return-cylinder": {
    type: "Purchase Return Cylinder Receipt",
    module: "purchase-filled-cylinders",
    sourceType: "PurchaseReturnCylinder",
    stockSourceType: StockSourceType.PURCHASE_RETURN,
  },
  "purchase-return-other": {
    type: "Purchase Return Other Receipt",
    module: "purchase-filled-cylinders",
    sourceType: "PurchaseReturnOther",
  },
  "cash-receipt": {
    type: "Cash Receipt Voucher",
    module: "cash-receipts",
    sourceType: "CashReceipt",
  },
  "cash-payment": {
    type: "Cash Payment Voucher",
    module: "cash-payments",
    sourceType: "CashPayment",
  },
  "bank-receipt": {
    type: "Bank Receipt Voucher",
    module: "bank-receipts",
    sourceType: "BankReceipt",
  },
  "bank-payment": {
    type: "Bank Payment Voucher",
    module: "bank-payments",
    sourceType: "BankPayment",
  },
  "security-receipt": {
    type: "Security Receipt Voucher",
    module: "cash-receipts",
    sourceType: "SecurityReceipt",
  },
  "journal-voucher": {
    type: "Journal Voucher",
    module: "journal-vouchers",
    sourceType: "JournalVoucher",
  },
  "opening-voucher": {
    type: "Opening Voucher",
    module: "opening-voucher",
    sourceType: "OpeningVoucher",
    voucherByDocumentNo: true,
  },
  "local-purchase": {
    type: "Local Bulk Purchase",
    module: "local-purchase",
    sourceType: "LocalPurchase",
    bulkSourceType: BulkStockSourceType.LOCAL_PURCHASE,
    voucherByDocumentNo: true,
  },
  "delivered-sale": {
    type: "Delivered Bulk Sale",
    module: "delivered-sale",
    sourceType: "DeliveredSale",
    bulkSourceType: BulkStockSourceType.DELIVERED_SALE,
    voucherByDocumentNo: true,
  },
  "plant-bulk-sale": {
    type: "Plant Bulk Sale",
    module: "plant-bulk-sale",
    sourceType: "PlantBulkSale",
    bulkSourceType: BulkStockSourceType.PLANT_SALE,
    voucherByDocumentNo: true,
  },
  "filling-sale": {
    type: "Filling Sale",
    module: "filling-sale",
    sourceType: "FillingSale",
    bulkSourceType: BulkStockSourceType.PLANT_SALE,
    voucherByDocumentNo: true,
  },
  "dollar-transaction": {
    type: "Dollar Transaction",
    module: "dollar-transactions",
    sourceType: "DollarTransaction",
    bulkSourceType: BulkStockSourceType.DOLLAR_SALE,
    voucherByDocumentNo: true,
  },
  "dollar-settlement": {
    type: "Dollar Settlement",
    module: "dollar-transactions",
    sourceType: "DollarSettlement",
    voucherByDocumentNo: true,
  },
  "loading": { type: "Import Loading", module: "loadings", bulkSourceType: BulkStockSourceType.LOADING },
  "plant-transfer": { type: "Plant Transfer", module: "plant-transfer", bulkSourceType: BulkStockSourceType.PLANT_TRANSFER },
  "plant-decanting": { type: "Plant Decanting", module: "plant-decanting", bulkSourceType: BulkStockSourceType.DECANTING },
  "partial-receiving": { type: "Partial Receiving", module: "partial-receiving", bulkSourceType: BulkStockSourceType.PARTIAL_RECEIVING },
  "partial-plant-sale": { type: "Partial Plant Sale", module: "partial-plant-sale", sourceType: "PartialPlantSale", bulkSourceType: BulkStockSourceType.PARTIAL_SALE, voucherByDocumentNo: true },
};

function isDocumentType(value: string) {
  return value in documentConfigs;
}

function money(value: unknown) {
  return value && typeof value === "object" && "toString" in value ? String(value) : "0";
}

function dateText(value: Date | string | null | undefined) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
}

function auditObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function resolveBulkSourceIds(documentType: string, companyId: string, documentNo: string) {
  if (documentType === "loading") {
    const row = await prisma.loading.findFirst({ where: { companyId, loadingNo: documentNo }, select: { id: true } });
    return row ? [row.id] : [];
  }
  if (documentType === "plant-transfer") {
    const row = await prisma.plantTransfer.findFirst({ where: { companyId, documentNo }, select: { id: true } });
    return row ? [row.id] : [];
  }
  if (documentType === "plant-decanting") {
    const row = await prisma.plantDecanting.findFirst({ where: { companyId, documentNo }, select: { id: true } });
    return row ? [row.id] : [];
  }
  if (documentType === "partial-receiving") {
    const row = await prisma.partialReceiving.findFirst({ where: { companyId, documentNo }, select: { id: true } });
    if (!row) return [];
    const events = await prisma.partialReceivingEvent.findMany({ where: { partialReceivingId: row.id }, select: { id: true } });
    return events.map((event) => event.id);
  }
  if (documentType === "partial-plant-sale") {
    const row = await prisma.partialPlantSale.findFirst({ where: { companyId, documentNo }, select: { id: true } });
    return row ? [row.id] : [];
  }
  return [];
}

export async function GET(request: Request, { params }: { params: Promise<{ documentType: string; documentNo: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { documentType, documentNo } = await params;
    if (!isDocumentType(documentType)) {
      throw new Error("Unknown transaction document type.");
    }

    const config = documentConfigs[documentType];
    await enforcePermission(prisma, context.userId, config.module, PermissionAction.PRINT);

    const [company, voucher, stockEntries] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: context.companyId },
        select: {
          legalName: true,
          tradeName: true,
          logoUrl: true,
          address: true,
          phone: true,
          email: true,
          taxRegistrationNumber: true,
          nationalTaxNumber: true,
        },
      }),
      config.sourceType ? prisma.accountingVoucher.findFirst({
        where: {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          ...(config.voucherByDocumentNo ? { voucherNo: documentNo, sourceType: config.sourceType } : { sourceType: config.sourceType, sourceId: documentNo }),
        },
        include: {
          lines: {
            orderBy: { sortOrder: "asc" },
            include: { account: { select: { code: true, name: true } } },
          },
        },
      }) : Promise.resolve(null),
      config.stockSourceType
        ? prisma.stockLedgerEntry.findMany({
            where: {
              companyId: context.companyId,
              financialYearId: context.financialYearId,
              sourceType: config.stockSourceType,
              sourceId: documentNo,
            },
            orderBy: { createdAt: "asc" },
            include: {
              item: { select: { code: true, name: true } },
              customer: { select: { code: true, name: true } },
              vendor: { select: { code: true, name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const bulkSourceIds = config.bulkSourceType
      ? voucher?.sourceId ? [voucher.sourceId] : await resolveBulkSourceIds(documentType, context.companyId, documentNo)
      : [];
    const bulkStockEntries = config.bulkSourceType && bulkSourceIds.length > 0
      ? await prisma.bulkStockLedgerEntry.findMany({
          where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: config.bulkSourceType, sourceId: { in: bulkSourceIds } },
          orderBy: { createdAt: "asc" },
          select: { id: true, productId: true, direction: true, quantity: true, unit: true, transactionDate: true },
        })
      : [];
    const bulkProducts = bulkStockEntries.length > 0
      ? await prisma.bulkProduct.findMany({ where: { companyId: context.companyId, id: { in: [...new Set(bulkStockEntries.map((entry) => entry.productId))] } }, select: { id: true, code: true, name: true } })
      : [];
    const bulkProductMap = new Map(bulkProducts.map((product) => [product.id, product]));

    if (!voucher && stockEntries.length === 0 && bulkStockEntries.length === 0) {
      throw new Error("Transaction document was not found.");
    }

    const party = stockEntries[0]?.customer ?? stockEntries[0]?.vendor;
    const voucherPartyLine = voucher?.lines.find((line) => line.account && !line.debit.equals(0)) ?? voucher?.lines[0];
    const partyName = party ? [party.code, party.name].filter(Boolean).join(" - ") : voucherPartyLine?.account ? [voucherPartyLine.account.code, voucherPartyLine.account.name].filter(Boolean).join(" - ") : "";
    const date = dateText(voucher?.voucherDate ?? stockEntries[0]?.transactionDate ?? bulkStockEntries[0]?.transactionDate);
    const auditLineEntityType =
      documentType === "purchase-filled-cylinder"
        ? "PurchaseFilledCylinder"
        : documentType === "purchase-empty-cylinder"
          ? "PurchaseEmptyCylinder"
          : documentType === "purchase-other"
            ? "PurchaseOther"
            : documentType === "sale-lpg"
              ? "SaleLpg"
            : documentType === "delivery-challan"
              ? "DeliveryChallan"
            : documentType === "cylinder-return"
              ? "CylinderReturn"
              : documentType === "cylinder-conversion"
                ? "CylinderConversion"
                : documentType === "empty-sale"
                  ? "EmptySale"
                  : documentType === "decanting-sale"
                    ? "DecantingSale"
                    : documentType === "purchase-return-cylinder"
                      ? "PurchaseReturnCylinder"
                      : documentType === "purchase-return-other"
                      ? "PurchaseReturnOther"
                        : documentType === "security-receipt"
                          ? "SecurityReceipt"
                        : null;
    const lineAudit =
      auditLineEntityType
        ? await prisma.auditLog.findFirst({
            where: { companyId: context.companyId, entityType: auditLineEntityType, entityId: documentNo },
            orderBy: { createdAt: "desc" },
          })
        : null;
    const lineAuditAfter = auditObject(lineAudit?.after);
    const auditLines = Array.isArray(lineAuditAfter.lines) ? (lineAuditAfter.lines as Array<Record<string, unknown>>) : null;

    const auditPartyName = typeof lineAuditAfter.vendor === "string" ? lineAuditAfter.vendor : typeof lineAuditAfter.customer === "string" ? lineAuditAfter.customer : "";
    const isPurchaseVendorDocument = documentType === "purchase-return-cylinder" || documentType === "purchase-return-other" || documentType === "purchase-empty-cylinder" || documentType === "purchase-other";

    return ok({
      document: {
        heading: company.tradeName || company.legalName || "LPG Management System",
        legalName: company.legalName,
        logoUrl: company.logoUrl,
        companyAddress: company.address,
        companyPhone: company.phone,
        companyEmail: company.email,
        taxRegistrationNumber: company.taxRegistrationNumber,
        nationalTaxNumber: company.nationalTaxNumber,
        type: config.type,
        number: documentNo,
        date,
        invoiceLanguage:
          documentType === "sale-lpg" || documentType === "empty-sale"
            ? String(lineAuditAfter.invoiceLanguage ?? "English")
            : undefined,
        partyLabel: isPurchaseVendorDocument ? "Vendor" : party ? (stockEntries[0]?.customer ? "Customer" : "Vendor") : "Account",
        partyName: auditPartyName || partyName,
        remarks: typeof lineAuditAfter.remarks === "string" ? lineAuditAfter.remarks : "",
        chequeNo: typeof lineAuditAfter.chequeNo === "string" ? lineAuditAfter.chequeNo : "",
        chequeDate: typeof lineAuditAfter.chequeDate === "string" ? lineAuditAfter.chequeDate : "",
        lineItems:
          auditLines ?? [
            ...stockEntries.map((entry) => ({
              id: entry.id,
              item: [entry.item.code, entry.item.name].filter(Boolean).join(" - "),
              cylinderState: entry.cylinderState,
              direction: entry.direction,
              quantity: entry.quantity,
            })),
            ...bulkStockEntries.map((entry) => ({
              id: entry.id,
              item: [bulkProductMap.get(entry.productId)?.code, bulkProductMap.get(entry.productId)?.name].filter(Boolean).join(" - "),
              cylinderState: "BULK",
              direction: entry.direction,
              quantity: entry.quantity,
              unit: entry.unit,
            })),
          ],
        voucherLines:
          voucher?.lines.map((line) => ({
            id: line.id,
            account: [line.account.code, line.account.name].filter(Boolean).join(" - "),
            description: line.description ?? "",
            debit: money(line.debit),
            credit: money(line.credit),
          })) ?? [],
        totals: {
          totalDebit: money(voucher?.totalDebit),
          totalCredit: money(voucher?.totalCredit),
          quantity: (() => {
            const quantities = [
              ...stockEntries.map((entry) => ({ direction: entry.direction, quantity: entry.quantity })),
              ...bulkStockEntries.map((entry) => ({ direction: entry.direction, quantity: Number(entry.quantity) })),
            ];
            const inbound = quantities.filter((entry) => entry.direction === "IN").reduce((sum, entry) => sum + entry.quantity, 0);
            return inbound > 0 ? inbound : quantities.reduce((sum, entry) => sum + entry.quantity, 0);
          })(),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && /authentication required/i.test(error.message)) {
      return fail(error.message, 401, "UNAUTHORIZED");
    }
    return serviceError(error);
  }
}
