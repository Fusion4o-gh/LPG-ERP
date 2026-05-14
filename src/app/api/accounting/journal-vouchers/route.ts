import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalStringField, readJson } from "../../../../server/api/validation.ts";
import { createJournalVoucher, listJournalVouchers } from "../../../../server/services/accounting/journal-voucher.ts";

function parseLines(raw: Record<string, unknown>[]) {
  return raw.map((line, i) => {
    if (typeof line.accountId !== "string" || !line.accountId.trim()) {
      throw new Error(`lines[${i}].accountId is required.`);
    }
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (!Number.isFinite(debit) || debit < 0) throw new Error(`lines[${i}].debit must be a non-negative number.`);
    if (!Number.isFinite(credit) || credit < 0) throw new Error(`lines[${i}].credit must be a non-negative number.`);
    return {
      accountId: line.accountId as string,
      description: typeof line.description === "string" ? line.description : undefined,
      debit,
      credit,
    };
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const vouchers = await listJournalVouchers(context);
    return ok({
      vouchers: vouchers.map((v) => ({
        ...v,
        totalDebit: String(v.totalDebit),
        totalCredit: String(v.totalCredit),
        voucherDate: v.voucherDate instanceof Date ? v.voucherDate.toISOString().slice(0, 10) : String(v.voucherDate),
      })),
    });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const rawLines = arrayField(body, "lines");
    const result = await createJournalVoucher({
      ...context,
      voucherDate: dateField(body, "voucherDate"),
      narration: optionalStringField(body, "narration"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      lines: parseLines(rawLines),
    });
    return ok({ voucherNo: result.voucherNo, voucherId: result.voucher.id });
  } catch (error) {
    return error instanceof Error && /required|balanced|must/i.test(error.message)
      ? fail(error.message)
      : serviceError(error);
  }
}
