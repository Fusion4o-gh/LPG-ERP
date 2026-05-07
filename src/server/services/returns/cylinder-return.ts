import { CylinderState, PartyType, PermissionAction, StockDirection, StockSourceType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type CylinderReturnInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  returnNo: string;
  customerId: string;
  itemId: string;
  quantity: number;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

export async function cylinderReturn(input: CylinderReturnInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "cylinder-returns", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const balance = await tx.customerCylinderBalance.findUnique({
      where: { customerId_itemId: { customerId: input.customerId, itemId: input.itemId } },
      select: { emptyOwed: true },
    });
    if (!balance || balance.emptyOwed < input.quantity) {
      throw new Error("Customer does not owe enough empty cylinders for this return.");
    }

    const stockEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: input.itemId,
      cylinderState: CylinderState.EMPTY,
      direction: StockDirection.IN,
      sourceType: StockSourceType.CYLINDER_RETURN,
      sourceId: input.returnNo,
      transactionDate: input.transactionDate,
      quantity: input.quantity,
      createdById: input.userId,
      partyType: PartyType.CUSTOMER,
      customerId: input.customerId,
    });

    await tx.customerCylinderBalance.update({
      where: { customerId_itemId: { customerId: input.customerId, itemId: input.itemId } },
      data: { emptyOwed: { decrement: input.quantity } },
    });

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "CylinderReturn",
      entityId: input.returnNo,
      after: input,
    });

    return { stockEntries: [stockEntry] };
  });
}
