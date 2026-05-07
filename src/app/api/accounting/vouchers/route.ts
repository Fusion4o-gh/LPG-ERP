import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const vouchers = await prisma.accountingVoucher.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, totalDebit: true, totalCredit: true, sourceType: true, sourceId: true },
      take: 300,
    });
    return ok({
      vouchers: vouchers.map((voucher) => ({
        ...voucher,
        total: voucher.totalDebit,
        balanceStatus: voucher.totalDebit.equals(voucher.totalCredit) ? "Balanced" : "Unbalanced",
      })),
    });
  } catch (error) {
    return serviceError(error);
  }
}
