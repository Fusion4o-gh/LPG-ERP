import { nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { purchaseReturnOther } from "../../../../server/services/returns/purchase-return.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

const PURCHASE_RETURN_PREFIX = "PRTN";

function optionalNumber(body: Record<string, unknown>, name: string) {
  return body[name] === undefined ? undefined : optionalPositiveNumberField(body, name);
}

function dateOrTransactionDate(body: Record<string, unknown>) {
  return dateField({ transactionDate: body.transactionDate ?? body.date }, "transactionDate");
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const returnNo = optionalStringField(body, "returnNo") ?? (await nextDocumentNumber({ ...context, prefix: PURCHASE_RETURN_PREFIX }));
    const lines = Array.isArray(body.lines)
      ? arrayField(body, "lines").map((line) => ({
          accountId: optionalStringField(line, "accountId"),
          itemId: optionalStringField(line, "itemId"),
          description: optionalStringField(line, "description"),
          quantity: optionalNumber(line, "quantity"),
          amount: optionalNumber(line, "amount"),
          unitPrice: optionalNumber(line, "unitPrice"),
          gstPercent: optionalPositiveNumberField(line, "gstPercent"),
          gstAmount: optionalPositiveNumberField(line, "gstAmount"),
        }))
      : undefined;
    const result = await purchaseReturnOther({
      ...context,
      returnNo,
      vendorId: stringField(body, "vendorId"),
      accountId: lines ? undefined : optionalStringField(body, "accountId"),
      itemId: lines ? undefined : optionalStringField(body, "itemId"),
      description: lines ? undefined : optionalStringField(body, "description"),
      quantity: lines ? undefined : optionalNumber(body, "quantity"),
      amount: lines ? undefined : optionalNumber(body, "amount"),
      unitPrice: lines ? undefined : optionalNumber(body, "unitPrice"),
      gstPercent: lines ? undefined : optionalPositiveNumberField(body, "gstPercent"),
      gstAmount: lines ? undefined : optionalPositiveNumberField(body, "gstAmount"),
      remarks: optionalStringField(body, "remarks"),
      lines,
      transactionDate: dateOrTransactionDate(body),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return ok({ returnNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id, stockEntryIds: [] } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
