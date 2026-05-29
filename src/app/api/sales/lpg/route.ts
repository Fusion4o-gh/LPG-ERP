import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { listSaleLpg, saleLpgSingle } from "../../../../server/services/sales/sale-lpg.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalPositiveNumberField, optionalStringField, positiveIntegerField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const sales = await listSaleLpg(context, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50,
    });
    return ok({ sales });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const issueNo = optionalStringField(body, "issueNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.saleIssue }));
    const lines = Array.isArray(body.lines)
      ? arrayField(body, "lines").map((line) => ({
          itemId: stringField(line, "itemId"),
          quantity: positiveIntegerField(line, "quantity"),
          unitPrice: positiveNumberField(line, "unitPrice"),
          gstPercent: optionalPositiveNumberField(line, "gstPercent"),
          gstAmount: optionalPositiveNumberField(line, "gstAmount"),
          securityDepositAmount: optionalPositiveNumberField(line, "securityDepositAmount"),
          emptyReturnItemId: optionalStringField(line, "emptyReturnItemId"),
          emptyReturnQuantity: optionalPositiveNumberField(line, "emptyReturnQuantity"),
        }))
      : undefined;
    const result = await saleLpgSingle({
      ...context,
      issueNo,
      customerId: stringField(body, "customerId"),
      itemId: lines ? undefined : stringField(body, "itemId"),
      quantity: lines ? undefined : positiveIntegerField(body, "quantity"),
      unitPrice: lines ? undefined : positiveNumberField(body, "unitPrice"),
      gstAmount: lines ? undefined : optionalPositiveNumberField(body, "gstAmount"),
      gstPercent: lines ? undefined : optionalPositiveNumberField(body, "gstPercent"),
      securityDepositAmount: lines ? undefined : optionalPositiveNumberField(body, "securityDepositAmount"),
      saleType: optionalStringField(body, "saleType") ?? "Direct",
      remarks: optionalStringField(body, "remarks"),
      elevenPointEightKgPrice: optionalPositiveNumberField(body, "elevenPointEightKgPrice"),
      invoiceLanguage: optionalStringField(body, "invoiceLanguage") ?? "English",
      lines,
      transactionDate: dateField(body, "transactionDate"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      discount: optionalPositiveNumberField(body, "discount"),
      amountReceived: optionalPositiveNumberField(body, "amountReceived"),
      receiveMode: optionalStringField(body, "receiveMode"),
      bankId: optionalStringField(body, "bankId"),
      chequeNo: optionalStringField(body, "chequeNo"),
      chequeDate: optionalStringField(body, "chequeDate"),
      returnGasKg: optionalPositiveNumberField(body, "returnGasKg"),
      gasReturnRate: optionalPositiveNumberField(body, "gasReturnRate"),
    });

    return ok({
      issueNo,
      voucherNo: result.voucher.voucherNo,
      receiptVoucherNo: result.receiptVoucher?.voucherNo ?? null,
      netReceivableAmount: String(result.netReceivableAmount),
      ids: { voucherId: result.voucher.id, stockEntryIds: result.stockEntries.map((entry) => entry.id) },
    });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
