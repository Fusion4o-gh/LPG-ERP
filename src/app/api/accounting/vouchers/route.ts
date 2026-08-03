import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { VoucherType } from "@prisma/client";

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvResponse(csv: string) {
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="voucher-list.csv"' } });
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const from = params.get("from") ?? undefined;
    const to = params.get("to") ?? undefined;
    const voucherType = params.get("voucherType") ?? undefined;
    const search = params.get("search")?.trim() ?? "";
    if (voucherType && !Object.values(VoucherType).includes(voucherType as VoucherType)) throw new Error("voucherType must be valid.");
    const vouchers = await prisma.accountingVoucher.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        voucherType: voucherType as VoucherType | undefined,
        ...(from || to ? { voucherDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {}),
        ...(search ? { OR: [{ voucherNo: { contains: search, mode: "insensitive" as const } }, { sourceId: { contains: search, mode: "insensitive" as const } }, { narration: { contains: search, mode: "insensitive" as const } }] } : {}),
      },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, totalDebit: true, totalCredit: true, sourceType: true, sourceId: true },
      take: 300,
    });
    const result = vouchers.map((voucher) => ({
        ...voucher,
        total: voucher.totalDebit,
        balanceStatus: voucher.totalDebit.equals(voucher.totalCredit) ? "Balanced" : "Unbalanced",
      }));
    if (params.get("format") === "csv") {
      const lines = [
        ["Voucher No", "Type", "Date", "Total Debit", "Total Credit", "Status", "Source Type", "Source Document"],
        ...result.map((voucher) => [voucher.voucherNo, voucher.voucherType, voucher.voucherDate.toISOString().slice(0, 10), voucher.totalDebit, voucher.totalCredit, voucher.balanceStatus, voucher.sourceType, voucher.sourceId]),
      ];
      return csvResponse(lines.map((line) => line.map(csvCell).join(",")).join("\n"));
    }
    return ok({ vouchers: result });
  } catch (error) {
    return serviceError(error);
  }
}
