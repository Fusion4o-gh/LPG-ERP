import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { cancelDeliveryChallan, getDeliveryChallan } from "../../../../../server/services/sales/delivery-challan.ts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const challan = await prisma.$transaction((tx) => getDeliveryChallan(tx, context.companyId, id));
    return ok({ challan });
  } catch (error) {
    return serviceError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const url = new URL(request.url);
    const remarks = url.searchParams.get("remarks") ?? undefined;
    const allowClosedDayOverride = url.searchParams.get("allowClosedDayOverride") === "1";
    const challan = await prisma.$transaction((tx) =>
      cancelDeliveryChallan(tx, {
        ...context,
        id,
        remarks,
        allowClosedDayOverride,
      }),
    );
    return ok({ challan });
  } catch (error) {
    return error instanceof Error && /required|Only dispatched|was not found|insufficient/i.test(error.message)
      ? fail(error.message)
      : serviceError(error);
  }
}
