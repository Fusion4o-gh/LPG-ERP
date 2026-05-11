import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { cylinderConversion } from "../../../../server/services/inventory/cylinder-conversion.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalStringField, positiveIntegerField, readJson } from "../../../../server/api/validation.ts";

function stringAlias(body: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = optionalStringField(body, name);
    if (value) return value;
  }
  throw new Error(`${names[0]} is required.`);
}

function integerAlias(body: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (body[name] !== undefined && body[name] !== null) {
      return positiveIntegerField(body, name);
    }
  }
  throw new Error(`${names[0]} is required.`);
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const conversionNo = optionalStringField(body, "conversionNo") ?? optionalStringField(body, "referenceNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.cylinderConversion }));
    const result = await cylinderConversion({
      ...context,
      conversionNo,
      referenceNo: optionalStringField(body, "referenceNo"),
      fromItemId: stringAlias(body, ["fromItemId", "fromItem", "sourceItemId"]),
      fromQuantity: integerAlias(body, ["fromQuantity", "fromQty", "sourceQuantity"]),
      toItemId: stringAlias(body, ["toItemId", "toItem", "destinationItemId"]),
      toQuantity: integerAlias(body, ["toQuantity", "toQty", "destinationQuantity"]),
      fromCylinderState: optionalStringField(body, "fromCylinderState"),
      toCylinderState: optionalStringField(body, "toCylinderState"),
      remarks: optionalStringField(body, "remarks"),
      transactionDate: body.transactionDate === undefined ? dateField(body, "date") : dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });

    return ok({ conversionNo, ids: { stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
