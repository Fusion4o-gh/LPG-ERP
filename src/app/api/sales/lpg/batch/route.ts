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
    const sales = [];
    for (const sale of arrayField(body, "sales")) {
      sales.push({
        issueNo: optionalStringField(sale, "issueNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.saleIssue })),
        customerId: stringField(sale, "customerId"),
        itemId: stringField(sale, "itemId"),
        quantity: positiveIntegerField(sale, "quantity"),
        unitPrice: positiveNumberField(sale, "unitPrice"),
        gstAmount: optionalPositiveNumberField(sale, "gstAmount"),
        securityDepositAmount: optionalPositiveNumberField(sale, "securityDepositAmount"),
        transactionDate: dateField(sale, "transactionDate"),
      });
    }
    const result = await saleLpgCompleteDayBatch({ ...context, batchNo, sales, allowClosedDayOverride: booleanField(body, "allowClosedDayOverride") });
    return ok({ batchNo, issueNos: sales.map((sale) => sale.issueNo), ids: { voucherIds: result.sales.map((sale) => sale.voucher.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
