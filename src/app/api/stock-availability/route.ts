import { CylinderState, PermissionAction } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../server/api/responses.ts";
import { getStockByItemAndState } from "../../../server/services/inventory/stock-availability.ts";
import { enforcePermission } from "../../../server/services/rbac/enforce.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const itemId = params.get("itemId")?.trim();
    const requestedState = params.get("cylinderState")?.trim() || CylinderState.FILLED;
    if (requestedState !== CylinderState.FILLED && requestedState !== CylinderState.EMPTY) {
      throw new Error("cylinderState must be FILLED or EMPTY.");
    }
    if (!itemId) return ok({ itemId: null, available: 0 });

    return ok(
      await prisma.$transaction(async (tx) => {
        await enforcePermission(tx, context.userId, "stock-ledger", PermissionAction.VIEW);
        const stock = await getStockByItemAndState(tx, {
          companyId: context.companyId,
          financialYearId: context.financialYearId,
          itemIds: [itemId],
          cylinderState: requestedState,
        });
        return { itemId, cylinderState: requestedState, available: stock.get(itemId) ?? 0 };
      }),
    );
  } catch (error) {
    return serviceError(error);
  }
}
