import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalStringField, readJson } from "../../../../server/api/validation.ts";
import { createOpeningVoucher, listOpeningVoucherAccounts, listOpeningVouchers } from "../../../../server/services/accounting/opening-voucher.ts";

function parseLines(rawLines: Record<string, unknown>[]) {
  return rawLines.map((line, index) => {
    if (typeof line.accountId !== "string" || !line.accountId.trim()) throw new Error(`lines[${index}].accountId is required.`);
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (!Number.isFinite(debit) || debit < 0 || !Number.isFinite(credit) || credit < 0) {
      throw new Error(`lines[${index}] debit and credit must be non-negative numbers.`);
    }
    return { accountId: line.accountId, description: typeof line.description === "string" ? line.description : undefined, debit, credit };
  });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const [vouchers, accounts] = await Promise.all([listOpeningVouchers(context), listOpeningVoucherAccounts(context)]);
    return ok({
      accounts,
      vouchers: vouchers.map((voucher) => ({
        ...voucher,
        voucherDate: voucher.voucherDate.toISOString().slice(0, 10),
        totalDebit: String(voucher.totalDebit),
        totalCredit: String(voucher.totalCredit),
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
    const result = await createOpeningVoucher(context, {
      voucherDate: dateField(body, "voucherDate"),
      narration: optionalStringField(body, "narration"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      lines: parseLines(arrayField(body, "lines")),
    });
    return ok({ voucherNo: result.voucherNo, voucherId: result.voucher.id });
  } catch (error) {
    return error instanceof Error && /required|balanced|must|number|permitted|does not exist/i.test(error.message)
      ? fail(error.message)
      : serviceError(error);
  }
}

