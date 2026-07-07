import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { securityReceipt } from "../../../../server/services/payments/security-receipt.ts";
import { listSecurityReceipts } from "../../../../server/services/lists/operational-document-list.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import {
  booleanField,
  dateField,
  optionalPositiveNumberField,
  optionalStringField,
  positiveIntegerField,
  positiveNumberField,
  readJson,
  stringField,
} from "../../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const result = await listSecurityReceipts(context, {
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
    const receiptNo = optionalStringField(body, "receiptNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.securityReceipt }));
    const result = await securityReceipt({
      ...context,
      receiptNo,
      customerId: stringField(body, "customerId"),
      itemId: stringField(body, "itemId"),
      bankId: optionalStringField(body, "bankId"),
      quantity: body.quantity === undefined ? undefined : positiveIntegerField(body, "quantity"),
      receiveMode: optionalStringField(body, "receiveMode"),
      chequeNo: optionalStringField(body, "chequeNo"),
      amount: positiveNumberField(body, "amount"),
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return ok({ receiptNo, voucherNo: result.voucher.voucherNo, ids: { voucherId: result.voucher.id } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
