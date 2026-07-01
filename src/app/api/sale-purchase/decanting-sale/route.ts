import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { decantingSale } from "../../../../server/services/sales/decanting-sale.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

function dateOrTransactionDate(body: Record<string, unknown>) {
  return dateField({ transactionDate: body.transactionDate ?? body.date }, "transactionDate");
}

function issueNumber(body: Record<string, unknown>) {
  return optionalStringField(body, "issueNo") ?? optionalStringField(body, "documentNo") ?? optionalStringField(body, "invoiceNo");
}

function sourceItemId(body: Record<string, unknown>) {
  return optionalStringField(body, "sourceItemId") ?? optionalStringField(body, "sourceItem") ?? stringField(body, "itemId");
}

function sourceQuantity(body: Record<string, unknown>) {
  if (body.sourceQuantity !== undefined) return positiveIntegerField(body, "sourceQuantity");
  return positiveIntegerField(body, "quantity");
}

function decantedQuantity(body: Record<string, unknown>) {
  if (body.decantedQuantity !== undefined) return positiveNumberField(body, "decantedQuantity");
  if (body.decantedQty !== undefined) return positiveNumberField(body, "decantedQty");
  return positiveNumberField(body, "saleQuantity");
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const issueNo = issueNumber(body) ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.decantingSaleIssue }));
    const result = await decantingSale({
      ...context,
      issueNo,
      customerId: optionalStringField(body, "customerId"),
      sourceItemId: sourceItemId(body),
      sourceQuantity: sourceQuantity(body),
      decantedQuantity: decantedQuantity(body),
      unitPrice: optionalPositiveNumberField(body, "unitPrice"),

      remarks: optionalStringField(body, "remarks"),
      transactionDate: dateOrTransactionDate(body),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });

    return ok({ issueNo, voucherNo: result.voucher?.voucherNo, ids: { voucherId: result.voucher?.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
