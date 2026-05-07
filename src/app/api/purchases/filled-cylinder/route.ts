import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { purchaseFilledCylinder } from "../../../../server/services/purchases/purchase-filled-cylinder.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const issueNo = optionalStringField(body, "issueNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.purchaseReceipt }));
    const result = await purchaseFilledCylinder({
      ...context,
      issueNo,
      vendorId: stringField(body, "vendorId"),
      itemId: stringField(body, "itemId"),
      quantity: positiveIntegerField(body, "quantity"),
      unitCost: positiveNumberField(body, "unitCost"),
      gstAmount: optionalPositiveNumberField(body, "gstAmount"),
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });

    return ok({ issueNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
