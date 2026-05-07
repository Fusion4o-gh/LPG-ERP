import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { saleLpgSingle } from "../../../../server/services/sales/sale-lpg.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const issueNo = optionalStringField(body, "issueNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.saleIssue }));
    const result = await saleLpgSingle({
      ...context,
      issueNo,
      customerId: stringField(body, "customerId"),
      itemId: stringField(body, "itemId"),
      quantity: positiveIntegerField(body, "quantity"),
      unitPrice: positiveNumberField(body, "unitPrice"),
      gstAmount: optionalPositiveNumberField(body, "gstAmount"),
      securityDepositAmount: optionalPositiveNumberField(body, "securityDepositAmount"),
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });

    return ok({ issueNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
