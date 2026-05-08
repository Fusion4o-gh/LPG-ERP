import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { cylinderReturn } from "../../../../server/services/returns/cylinder-return.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const returnNo = optionalStringField(body, "returnNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.cylinderReturn }));
    const lines = Array.isArray(body.lines)
      ? arrayField(body, "lines").map((line) => ({
          itemId: stringField(line, "itemId"),
          returnType: optionalStringField(line, "returnType") ?? "Empty",
          quantity: positiveIntegerField(line, "quantity"),
          unitPrice: optionalPositiveNumberField(line, "unitPrice"),
          gstPercent: optionalPositiveNumberField(line, "gstPercent"),
          gstAmount: optionalPositiveNumberField(line, "gstAmount"),
        }))
      : undefined;
    const result = await cylinderReturn({
      ...context,
      returnNo,
      customerId: stringField(body, "customerId"),
      itemId: lines ? undefined : stringField(body, "itemId"),
      quantity: lines ? undefined : positiveIntegerField(body, "quantity"),
      returnType: lines ? undefined : optionalStringField(body, "returnType"),
      unitPrice: lines ? undefined : optionalPositiveNumberField(body, "unitPrice"),
      gstPercent: lines ? undefined : optionalPositiveNumberField(body, "gstPercent"),
      remarks: optionalStringField(body, "remarks"),
      lines,
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return ok({ returnNo, ids: { stockEntryIds: result.stockEntries.map((entry) => entry.id), voucherId: result.voucher?.id } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
