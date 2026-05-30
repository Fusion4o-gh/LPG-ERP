import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { prisma } from "../../../../lib/prisma.ts";
import { isThemeId, themeCookieValue } from "../../../../lib/theme.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { uiTheme: true },
    });
    const theme = isThemeId(user.uiTheme) ? user.uiTheme : "aurora";
    return ok({ theme });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const theme = body.theme;
    if (!isThemeId(theme)) return fail("theme must be one of: aurora, midnight, graphite, emerald.");

    await prisma.user.update({
      where: { id: context.userId },
      data: { uiTheme: theme },
    });

    return Response.json(
      { success: true, theme },
      { headers: { "set-cookie": themeCookieValue(theme) } },
    );
  } catch (error) {
    return serviceError(error);
  }
}
