import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { cashReceipt } from "../../../../server/services/payments/cash-receipt.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const receiptNo = optionalStringField(body, "receiptNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.cashReceiptVoucher }));
    const result = await cashReceipt({
      ...context,
      receiptNo,
      customerId: stringField(body, "customerId"),
      amount: positiveNumberField(body, "amount"),
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return ok({ receiptNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
