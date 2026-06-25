import { prisma } from "@/lib/prisma";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "@/lib/theme";

export type AppShellContext = {
  userName: string;
  loginId: string;
  companyName: string;
  logoUrl: string | null;
  financialYearLabel: string;
  themeId: ThemeId;
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
      uiTheme: true,
      company: { select: { legalName: true, tradeName: true, logoUrl: true } },
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
    companyName: user?.company.tradeName ?? user?.company.legalName ?? "LPG Management System",
    logoUrl: user?.company.logoUrl ?? null,
    financialYearLabel: financialYear?.label ?? "—",
    themeId: (user?.uiTheme && isThemeId(user.uiTheme) ? user.uiTheme : DEFAULT_THEME) as ThemeId,
  };
}
