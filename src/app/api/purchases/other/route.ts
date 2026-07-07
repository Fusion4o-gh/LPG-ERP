import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { purchaseOther } from "../../../../server/services/purchases/purchase-empty-other.ts";
import { listPurchaseOther } from "../../../../server/services/lists/operational-document-list.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";

function optionalNumber(body: Record<string, unknown>, name: string) {
  return body[name] === undefined ? undefined : optionalPositiveNumberField(body, name);
}

function dateOrTransactionDate(body: Record<string, unknown>) {
  return dateField({ transactionDate: body.transactionDate ?? body.date }, "transactionDate");
}

function receiptNumber(body: Record<string, unknown>) {
  return optionalStringField(body, "receiptNo") ?? optionalStringField(body, "issueNo") ?? optionalStringField(body, "documentNo");
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const result = await listPurchaseOther(context, {
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
    const receiptNo = receiptNumber(body) ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.purchaseReceipt }));
    const lines = Array.isArray(body.lines)
      ? arrayField(body, "lines").map((line) => ({
          accountId: optionalStringField(line, "accountId"),
          itemId: optionalStringField(line, "itemId"),
          description: optionalStringField(line, "description"),
          quantity: optionalNumber(line, "quantity"),
          amount: optionalNumber(line, "amount"),
          unitPrice: optionalNumber({ unitPrice: line.unitPrice ?? line.unitCost }, "unitPrice"),
          gstPercent: optionalPositiveNumberField(line, "gstPercent"),
          gstAmount: optionalPositiveNumberField(line, "gstAmount"),
          stockIn: booleanField(line, "stockIn"),
          cylinderState: optionalStringField(line, "cylinderState") as never,
        }))
      : undefined;

    const result = await purchaseOther({
      ...context,
      receiptNo,
      vendorId: stringField(body, "vendorId"),
      accountId: lines ? undefined : optionalStringField(body, "accountId"),
      itemId: lines ? undefined : optionalStringField(body, "itemId"),
      description: lines ? undefined : optionalStringField(body, "description"),
      quantity: lines ? undefined : optionalNumber(body, "quantity"),
      amount: lines ? undefined : optionalNumber(body, "amount"),
      unitPrice: lines ? undefined : optionalNumber({ unitPrice: body.unitPrice ?? body.unitCost }, "unitPrice"),
      gstPercent: lines ? undefined : optionalPositiveNumberField(body, "gstPercent"),
      gstAmount: lines ? undefined : optionalPositiveNumberField(body, "gstAmount"),
      stockIn: lines ? undefined : booleanField(body, "stockIn"),
      cylinderState: lines ? undefined : (optionalStringField(body, "cylinderState") as never),
      remarks: optionalStringField(body, "remarks"),
      lines,
      transactionDate: dateOrTransactionDate(body),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      discount: optionalPositiveNumberField(body, "discount"),
      amountPaid: optionalPositiveNumberField(body, "amountPaid"),
      bankAmount: optionalPositiveNumberField(body, "bankAmount"),
      cashAmount: optionalPositiveNumberField(body, "cashAmount"),
      payMode: optionalStringField(body, "payMode"),
      bankId: optionalStringField(body, "bankId"),
      chequeNo: optionalStringField(body, "chequeNo"),
    });

    return ok({ receiptNo, issueNo: receiptNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
