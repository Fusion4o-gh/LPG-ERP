import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../../server/services/accounting/document-numbers.ts";
import { saleLpgCompleteDayBatch } from "../../../../../server/services/sales/sale-lpg.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const batchNo = optionalStringField(body, "batchNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.batchSaleIssue }));
    const headerDate = body.transactionDate ? dateField(body, "transactionDate") : undefined;
    const rows = Array.isArray(body.rows) ? arrayField(body, "rows") : arrayField(body, "sales");
    const sales = [];
    for (const sale of rows) {
      const lineItems = Array.isArray(sale.items)
        ? arrayField(sale, "items").map((item) => ({
            itemId: stringField(item, "itemId"),
            quantity: positiveIntegerField(item, "quantity"),
            unitPrice: positiveNumberField(item, "unitPrice"),

            securityDepositAmount: optionalPositiveNumberField(item, "securityDepositAmount"),
          }))
        : undefined;
      if (lineItems && lineItems.length > 3) {
        throw new Error("items supports up to 3 item selections per row.");
      }
      sales.push(
        lineItems
          ? {
              issueNo: optionalStringField(sale, "issueNo"),
              customerId: stringField(sale, "customerId"),
              elevenPointEightKgPrice: optionalPositiveNumberField(sale, "elevenPointEightKgPrice"),
              paymentType: optionalStringField(sale, "paymentType") ?? "Credit",
              amountReceived: optionalPositiveNumberField(sale, "amountReceived"),
              receiveMode: optionalStringField(sale, "receiveMode"),
              bankId: optionalStringField(sale, "bankId"),
              chequeNo: optionalStringField(sale, "chequeNo"),
              lines: lineItems,
              transactionDate: sale.transactionDate ? dateField(sale, "transactionDate") : headerDate,
            }
          : {
              issueNo: optionalStringField(sale, "issueNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.saleIssue })),
              customerId: stringField(sale, "customerId"),
              itemId: stringField(sale, "itemId"),
              quantity: positiveIntegerField(sale, "quantity"),
              unitPrice: positiveNumberField(sale, "unitPrice"),

              securityDepositAmount: optionalPositiveNumberField(sale, "securityDepositAmount"),
              transactionDate: dateField(sale, "transactionDate"),
            },
      );
    }
    const result = await saleLpgCompleteDayBatch({ ...context, batchNo, transactionDate: headerDate, remarks: optionalStringField(body, "remarks"), sales, allowClosedDayOverride: booleanField(body, "allowClosedDayOverride") });
    return ok({
      batchNo,
      issueNos: result.issueNos,
      ids: {
        voucherIds: result.sales.map((sale) => sale.voucher.id),
        receiptVoucherIds: result.sales.map((sale) => sale.receiptVoucher?.id).filter(Boolean),
      },
    });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
