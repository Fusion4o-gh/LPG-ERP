import { prisma } from "../../../../lib/prisma.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const loginId = new URL(request.url).searchParams.get("loginId")?.trim();
    if (!loginId) return fail("loginId is required.");

    const user = await prisma.user.findFirst({
      where: { loginId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        companyId: true,
        financialYearId: true,
        company: { select: { tradeName: true, legalName: true, logoUrl: true } },
      },
    });
    if (!user) return ok({ found: false, financialYears: [] });

    const financialYears = await prisma.financialYear.findMany({
      where: { companyId: user.companyId, isClosed: false },
      orderBy: { startsOn: "desc" },
      select: { id: true, label: true, isActive: true, startsOn: true, endsOn: true },
    });

    return ok({
      found: true,
      userName: user.name,
      companyName: user.company.tradeName || user.company.legalName,
      logoUrl: user.company.logoUrl,
      defaultFinancialYearId: user.financialYearId ?? financialYears.find((fy) => fy.isActive)?.id ?? financialYears[0]?.id,
      financialYears,
    });
  } catch (error) {
    return serviceError(error);
  }
}
