import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, booleanField, dateField, optionalStringField, readJson } from "../../../../server/api/validation.ts";
import { createDollarJournalVoucher, listDollarJournalVouchers } from "../../../../server/services/accounting/journal-voucher.ts";

function numberField(value: unknown, name: string) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name} must be a non-negative number.`);
  return number;
}

function parseLines(rawLines: Record<string, unknown>[]) {
  return rawLines.map((line, index) => {
    if (typeof line.accountId !== "string" || !line.accountId.trim()) throw new Error(`lines[${index}].accountId is required.`);
    return {
      accountId: line.accountId,
      description: typeof line.description === "string" ? line.description : undefined,
      debit: numberField(line.debit, `lines[${index}].debit`),
      credit: numberField(line.credit, `lines[${index}].credit`),
      foreignDebit: numberField(line.foreignDebit, `lines[${index}].foreignDebit`),
      foreignCredit: numberField(line.foreignCredit, `lines[${index}].foreignCredit`),
    };
  });
}

export async function GET(request: Request) {
  try {
    const rows = await listDollarJournalVouchers(await getRequestContext(request));
    return ok({ vouchers: rows.map((row) => ({
      ...row,
      totalDebit: String(row.totalDebit),
      totalCredit: String(row.totalCredit),
      voucherDate: row.voucherDate.toISOString().slice(0, 10),
      foreignDebit: row.lines.reduce((sum, line) => sum + Number(line.foreignDebit), 0).toFixed(2),
      foreignCredit: row.lines.reduce((sum, line) => sum + Number(line.foreignCredit), 0).toFixed(2),
    })) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const result = await createDollarJournalVoucher({
      ...context,
      voucherDate: dateField(body, "voucherDate"),
      narration: optionalStringField(body, "narration"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
      lines: parseLines(arrayField(body, "lines")),
    });
    return ok({ voucherNo: result.voucherNo, voucherId: result.voucher.id });
  } catch (error) {
    return error instanceof Error && /required|balanced|must|permitted|posted to|does not exist/i.test(error.message)
      ? fail(error.message)
      : serviceError(error);
  }
}
