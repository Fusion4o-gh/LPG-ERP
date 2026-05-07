import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../../server/api/responses.ts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const voucher = await prisma.accountingVoucher.findFirstOrThrow({
      where: { id, companyId: context.companyId, financialYearId: context.financialYearId },
      include: {
        lines: {
          orderBy: { sortOrder: "asc" },
          include: { account: { select: { code: true, name: true } } },
        },
      },
    });
    return ok({
      voucher: {
        ...voucher,
        balanceStatus: voucher.totalDebit.equals(voucher.totalCredit) ? "Balanced" : "Unbalanced",
      },
    });
  } catch (error) {
    return serviceError(error);
  }
}
