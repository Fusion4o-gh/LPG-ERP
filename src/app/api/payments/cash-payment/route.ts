import { DOCUMENT_PREFIXES, nextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { cashPayment, multiLineCashPayment } from "../../../../server/services/payments/cash-payment.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { booleanField, dateField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";

function parseLines(raw: unknown[]) {
  return raw.map((line, i) => {
    const l = line as Record<string, unknown>;
    if (typeof l.accountId !== "string" || !l.accountId.trim()) throw new Error(`lines[${i}].accountId is required.`);
    const amount = Number(l.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`lines[${i}].amount must be a positive number.`);
    return { accountId: l.accountId, amount, description: typeof l.description === "string" ? l.description : undefined };
  });
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const voucherNo = optionalStringField(body, "voucherNo") ?? (await nextDocumentNumber({ ...context, prefix: DOCUMENT_PREFIXES.cashPaymentVoucher }));
    const transactionDate = dateField(body, "transactionDate");
    const allowClosedDayOverride = booleanField(body, "allowClosedDayOverride");

    if (Array.isArray(body.lines) && body.lines.length > 0) {
      const lines = parseLines(body.lines);
      const result = await multiLineCashPayment({
        ...context,
        documentNo: voucherNo,
        transactionDate,
        narration: optionalStringField(body, "narration"),
        allowClosedDayOverride,
        lines,
      });
      return ok({ voucherNo, ids: { voucherId: result.voucher.id } });
    }

    const result = await cashPayment({
      ...context,
      voucherNo,
      vendorId: stringField(body, "vendorId"),
      amount: positiveNumberField(body, "amount"),
      transactionDate,
      allowClosedDayOverride,
    });
    return ok({ voucherNo, ids: { voucherId: result.voucher.id } });
  } catch (error) {
    return error instanceof Error && /required|positive|balanced|must|permitted|posted to|does not exist/i.test(error.message) ? fail(error.message) : serviceError(error);
  }
}
