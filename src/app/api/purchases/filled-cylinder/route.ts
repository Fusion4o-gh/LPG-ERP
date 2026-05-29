import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { purchaseFilledCylinder } from "../../../../server/services/purchases/purchase-filled-cylinder.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const issueNo = optionalStringField(body, "issueNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.purchaseReceipt }));
    const lines = Array.isArray(body.lines)
      ? arrayField(body, "lines").map((line) => ({
          itemId: stringField(line, "itemId"),
          cylinderState: optionalStringField(line, "cylinderState") as never,
          quantity: positiveIntegerField(line, "quantity"),
          unitCost: positiveNumberField(line, "unitCost"),
          gstPercent: optionalPositiveNumberField(line, "gstPercent"),
          gstAmount: optionalPositiveNumberField(line, "gstAmount"),
          emptyReturnQuantity: optionalPositiveNumberField(line, "emptyReturnQuantity"),
        }))
      : undefined;
    const result = await purchaseFilledCylinder({
      ...context,
      issueNo,
      vendorId: stringField(body, "vendorId"),
      itemId: lines ? undefined : stringField(body, "itemId"),
      quantity: lines ? undefined : positiveIntegerField(body, "quantity"),
      unitCost: lines ? undefined : positiveNumberField(body, "unitCost"),
      gstAmount: lines ? undefined : optionalPositiveNumberField(body, "gstAmount"),
      remarks: optionalStringField(body, "remarks"),
      elevenPointEightKgPrice: optionalPositiveNumberField(body, "elevenPointEightKgPrice"),
      lines,
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      discount: optionalPositiveNumberField(body, "discount"),
      amountPaid: optionalPositiveNumberField(body, "amountPaid"),
      payMode: optionalStringField(body, "payMode"),
      bankId: optionalStringField(body, "bankId"),
      chequeNo: optionalStringField(body, "chequeNo"),
      chequeDate: optionalStringField(body, "chequeDate"),
    });

    return ok({
      issueNo,
      voucherNo: result.voucher.voucherNo,
      paymentVoucherNo: result.paymentVoucher?.voucherNo ?? null,
      netPayableAmount: String(result.netPayableAmount),
      ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) },
    });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
