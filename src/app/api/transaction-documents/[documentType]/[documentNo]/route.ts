import { PermissionAction, StockSourceType } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { enforcePermission } from "../../../../../server/services/rbac/enforce.ts";

type DocumentConfig = {
  type: string;
  module: string;
  sourceType: string;
  stockSourceType?: StockSourceType;
};

const documentConfigs: Record<string, DocumentConfig> = {
  "sale-lpg": {
    type: "Sale LPG Invoice",
    module: "sale-lpg",
    sourceType: "SaleLpg",
    stockSourceType: StockSourceType.SALE_LPG,
  },
  "purchase-filled-cylinder": {
    type: "Purchase Filled Cylinder Receipt",
    module: "purchase-filled-cylinders",
    sourceType: "PurchaseFilledCylinder",
    stockSourceType: StockSourceType.PURCHASE_FILLED,
  },
  "cylinder-return": {
    type: "Cylinder Return Receipt",
    module: "cylinder-returns",
    sourceType: "CylinderReturn",
    stockSourceType: StockSourceType.CYLINDER_RETURN,
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

export async function GET(request: Request, { params }: { params: Promise<{ documentType: string; documentNo: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { documentType, documentNo } = await params;
    if (!isDocumentType(documentType)) {
      throw new Error("Unknown transaction document type.");
    }

    const config = documentConfigs[documentType];
    await enforcePermission(prisma, context.userId, config.module, PermissionAction.PRINT);

    const [voucher, stockEntries] = await Promise.all([
      prisma.accountingVoucher.findFirst({
        where: {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          sourceType: config.sourceType,
          sourceId: documentNo,
        },
        include: {
          lines: {
            orderBy: { sortOrder: "asc" },
            include: { account: { select: { code: true, name: true } } },
          },
        },
      }),
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

    if (!voucher && stockEntries.length === 0) {
      throw new Error("Transaction document was not found.");
    }

    const party = stockEntries[0]?.customer ?? stockEntries[0]?.vendor;
    const voucherPartyLine = voucher?.lines.find((line) => line.account && !line.debit.equals(0)) ?? voucher?.lines[0];
    const partyName = party ? [party.code, party.name].filter(Boolean).join(" - ") : voucherPartyLine?.account ? [voucherPartyLine.account.code, voucherPartyLine.account.name].filter(Boolean).join(" - ") : "";
    const date = dateText(voucher?.voucherDate ?? stockEntries[0]?.transactionDate);

    return ok({
      document: {
        heading: "LPG ERP",
        type: config.type,
        number: documentNo,
        date,
        partyLabel: party ? (stockEntries[0]?.customer ? "Customer" : "Vendor") : "Account",
        partyName,
        lineItems: stockEntries.map((entry) => ({
          id: entry.id,
          item: [entry.item.code, entry.item.name].filter(Boolean).join(" - "),
          cylinderState: entry.cylinderState,
          direction: entry.direction,
          quantity: entry.quantity,
        })),
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
          quantity: stockEntries.reduce((sum, entry) => sum + entry.quantity, 0),
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
