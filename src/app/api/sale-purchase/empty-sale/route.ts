import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { emptySale } from "../../../../server/services/sales/empty-sale.ts";
import { listEmptySales } from "../../../../server/services/lists/operational-document-list.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

function dateOrTransactionDate(body: Record<string, unknown>) {
  return dateField({ transactionDate: body.transactionDate ?? body.date }, "transactionDate");
}

function issueNumber(body: Record<string, unknown>) {
  return optionalStringField(body, "issueNo") ?? optionalStringField(body, "documentNo") ?? optionalStringField(body, "invoiceNo");
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const result = await listEmptySales(context, {
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
    const issueNo = issueNumber(body) ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.emptySaleIssue }));
    const lines = Array.isArray(body.lines)
      ? arrayField(body, "lines").map((line) => ({
          itemId: stringField(line, "itemId"),
          quantity: positiveIntegerField(line, "quantity"),
          unitPrice: positiveNumberField(line, "unitPrice"),

        }))
      : undefined;
    const result = await emptySale({
      ...context,
      issueNo,
      customerId: stringField(body, "customerId"),
      itemId: lines ? undefined : stringField(body, "itemId"),
      quantity: lines ? undefined : positiveIntegerField(body, "quantity"),
      unitPrice: lines ? undefined : positiveNumberField(body, "unitPrice"),

      remarks: optionalStringField(body, "remarks"),
      lines,
      transactionDate: dateOrTransactionDate(body),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      discount: optionalPositiveNumberField(body, "discount"),
      amountReceived: optionalPositiveNumberField(body, "amountReceived"),
      receiveMode: optionalStringField(body, "receiveMode"),
      bankId: optionalStringField(body, "bankId"),
      chequeNo: optionalStringField(body, "chequeNo"),
      invoiceLanguage: optionalStringField(body, "invoiceLanguage") ?? "English",
    });

    return ok({ issueNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
