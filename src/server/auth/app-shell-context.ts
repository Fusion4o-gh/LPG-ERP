import { prisma } from "@/lib/prisma";

export type AppShellContext = {
  userName: string;
  loginId: string;
  companyName: string;
  financialYearLabel: string;
};

export async function getAppShellContext(
  userId: string,
  financialYearId: string
): Promise<AppShellContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      loginId: true,
      company: { select: { legalName: true, tradeName: true } },
      financialYear: { select: { label: true } },
    },
  });

  const financialYear =
    user?.financialYear ??
    (await prisma.financialYear.findUnique({
      where: { id: financialYearId },
      select: { label: true },
    }));

  return {
    userName: user?.name ?? "User",
    loginId: user?.loginId ?? "",
    companyName: user?.company.tradeName ?? user?.company.legalName ?? "LPG ERP",
    financialYearLabel: financialYear?.label ?? "—",
  };
}
