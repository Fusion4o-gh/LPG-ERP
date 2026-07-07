import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { cylinderReturn } from "../../../../server/services/returns/cylinder-return.ts";
import { listCylinderReturns } from "../../../../server/services/lists/operational-document-list.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const result = await listCylinderReturns(context, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
      search: url.searchParams.get("search") ?? undefined,
    });
    return ok(result);
  } catch (error) {
    return serviceError(error);
  }
}

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

      remarks: optionalStringField(body, "remarks"),
      lines,
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      discount: optionalPositiveNumberField(body, "discount"),
      amountPaid: optionalPositiveNumberField(body, "amountPaid"),
      payMode: optionalStringField(body, "payMode"),
      bankId: optionalStringField(body, "bankId"),
      chequeNo: optionalStringField(body, "chequeNo"),
    });
    return ok({ returnNo, ids: { stockEntryIds: result.stockEntries.map((entry) => entry.id), voucherId: result.voucher?.id } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
