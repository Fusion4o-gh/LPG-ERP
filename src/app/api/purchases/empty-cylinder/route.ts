import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { purchaseEmptyCylinder } from "../../../../server/services/purchases/purchase-empty-other.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

function dateOrTransactionDate(body: Record<string, unknown>) {
  return dateField({ transactionDate: body.transactionDate ?? body.date }, "transactionDate");
}

function receiptNumber(body: Record<string, unknown>) {
  return optionalStringField(body, "receiptNo") ?? optionalStringField(body, "issueNo") ?? optionalStringField(body, "documentNo");
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const receiptNo = receiptNumber(body) ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.purchaseReceipt }));
    const lines = Array.isArray(body.lines)
      ? arrayField(body, "lines").map((line) => ({
          itemId: stringField(line, "itemId"),
          quantity: positiveIntegerField(line, "quantity"),
          unitPrice: positiveNumberField({ unitPrice: line.unitPrice ?? line.unitCost }, "unitPrice"),
          gstPercent: optionalPositiveNumberField(line, "gstPercent"),
          gstAmount: optionalPositiveNumberField(line, "gstAmount"),
        }))
      : undefined;

    const result = await purchaseEmptyCylinder({
      ...context,
      receiptNo,
      vendorId: stringField(body, "vendorId"),
      itemId: lines ? undefined : stringField(body, "itemId"),
      quantity: lines ? undefined : positiveIntegerField(body, "quantity"),
      unitPrice: lines ? undefined : positiveNumberField({ unitPrice: body.unitPrice ?? body.unitCost }, "unitPrice"),
      gstPercent: lines ? undefined : optionalPositiveNumberField(body, "gstPercent"),
      gstAmount: lines ? undefined : optionalPositiveNumberField(body, "gstAmount"),
      remarks: optionalStringField(body, "remarks"),
      lines,
      transactionDate: dateOrTransactionDate(body),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      discount: optionalPositiveNumberField(body, "discount"),
      amountPaid: optionalPositiveNumberField(body, "amountPaid"),
      payMode: optionalStringField(body, "payMode"),
      bankId: optionalStringField(body, "bankId"),
      chequeNo: optionalStringField(body, "chequeNo"),
    });

    return ok({ receiptNo, issueNo: receiptNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
