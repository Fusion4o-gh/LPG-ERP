import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { bankReceipt } from "../../../../server/services/payments/bank-receipt.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const receiptNo = optionalStringField(body, "receiptNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.bankReceiptVoucher }));
    const result = await bankReceipt({
      ...context,
      receiptNo,
      customerId: stringField(body, "customerId"),
      bankId: stringField(body, "bankId"),
      amount: positiveNumberField(body, "amount"),
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return ok({ receiptNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
