import { nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { purchaseReturnCylinder } from "../../../../server/services/returns/purchase-return.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

const PURCHASE_RETURN_PREFIX = "PRTN";

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
          itemId: stringField(line, "itemId"),
          quantity: positiveIntegerField(line, "quantity"),
          unitPrice: positiveNumberField({ unitPrice: line.unitPrice ?? line.unitCost }, "unitPrice"),
          gstPercent: optionalPositiveNumberField(line, "gstPercent"),
          gstAmount: optionalPositiveNumberField(line, "gstAmount"),
        }))
      : undefined;
    const result = await purchaseReturnCylinder({
      ...context,
      returnNo,
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
    });
    return ok({ returnNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
