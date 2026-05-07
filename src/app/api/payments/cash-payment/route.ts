import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { cashPayment } from "../../../../server/services/payments/cash-payment.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const voucherNo = optionalStringField(body, "voucherNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.cashPaymentVoucher }));
    const result = await cashPayment({
      ...context,
      voucherNo,
      vendorId: stringField(body, "vendorId"),
      amount: positiveNumberField(body, "amount"),
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return ok({ voucherNo, ids: { voucherId: result.voucher.id } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
