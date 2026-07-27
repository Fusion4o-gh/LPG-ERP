import {
  CylinderState,
  DeliveryChallanStatus,
  PartyType,
  PermissionAction,
  Prisma,
  StockDirection,
  StockSourceType,
} from "@prisma/client";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { assertFilledStockAvailable } from "../inventory/stock-availability.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = Prisma.TransactionClient;

export type DeliveryChallanLineInput = {
  itemId: string;
  quantity: number;
  remarks?: string;
};

export type CreateDeliveryChallanInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  documentNo: string;
  challanDate: string | Date;
  customerId: string;
  locationId?: string;
  transporterId?: string;
  vehicleId?: string;
  driverId?: string;
  remarks?: string;
  allowClosedDayOverride?: boolean;
  lines: DeliveryChallanLineInput[];
};

export type ListDeliveryChallansInput = {
  companyId: string;
  financialYearId: string;
  from?: string | Date;
  to?: string | Date;
  status?: DeliveryChallanStatus;
  customerId?: string;
  limit?: number;
  offset?: number;
  search?: string;
};

export type CancelDeliveryChallanInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  id: string;
  remarks?: string;
  allowClosedDayOverride?: boolean;
};

function normalizeLines(lines: DeliveryChallanLineInput[]) {
  if (!lines.length) throw new Error("At least one challan line is required.");
  return lines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`lines[${index}].quantity must be a positive integer.`);
    }
    return {
      itemId: line.itemId,
      quantity,
      remarks: line.remarks?.trim() || undefined,
    };
  });
}

export async function createDeliveryChallan(tx: Tx, input: CreateDeliveryChallanInput) {
  await enforcePermission(tx, input.userId, "delivery-challan", PermissionAction.CREATE);
  await assertWritableBusinessDate(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    userId: input.userId,
    transactionDate: input.challanDate,
    allowClosedDayOverride: input.allowClosedDayOverride,
  });

  if (!input.customerId) throw new Error("Customer is required.");
  const lines = normalizeLines(input.lines);

  const customer = await tx.customer.findFirst({
    where: { id: input.customerId, companyId: input.companyId },
    select: { id: true, code: true, name: true },
  });
  if (!customer) throw new Error("Customer was not found.");

  const itemRows = await tx.item.findMany({
    where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
    select: { id: true, code: true, name: true },
  });
  const itemById = new Map(itemRows.map((item) => [item.id, item]));
  for (const line of lines) {
    if (!itemById.has(line.itemId)) throw new Error(`Item ${line.itemId} was not found.`);
  }

  const company = await tx.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { stockAvailableCheck: true },
  });
  if (company.stockAvailableCheck) {
    await assertFilledStockAvailable(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      locationId: input.locationId,
      lines: lines.map((line) => {
        const item = itemById.get(line.itemId);
        return {
          itemId: line.itemId,
          quantity: line.quantity,
          itemLabel: item ? [item.code, item.name].filter(Boolean).join(" - ") : line.itemId,
        };
      }),
    });
  }

  const challan = await tx.deliveryChallan.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      documentNo: input.documentNo,
      challanDate: new Date(input.challanDate),
      customerId: input.customerId,
      locationId: input.locationId || null,
      transporterId: input.transporterId || null,
      vehicleId: input.vehicleId || null,
      driverId: input.driverId || null,
      remarks: input.remarks,
      status: DeliveryChallanStatus.DISPATCHED,
      createdById: input.userId,
      lines: {
        create: lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          remarks: line.remarks,
        })),
      },
    },
    include: { lines: true },
  });

  const stockEntries = [];
  for (const line of lines) {
    const stockEntry = await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.OUT,
      sourceType: StockSourceType.DELIVERY_CHALLAN,
      sourceId: input.documentNo,
      transactionDate: input.challanDate,
      quantity: line.quantity,
      createdById: input.userId,
      partyType: PartyType.CUSTOMER,
      customerId: input.customerId,
      locationId: input.locationId,
      remarks: line.remarks ?? "Delivery challan dispatch",
    });
    stockEntries.push(stockEntry);

    await tx.customerCylinderBalance.upsert({
      where: { customerId_itemId: { customerId: input.customerId, itemId: line.itemId } },
      update: { emptyOwed: { increment: line.quantity } },
      create: {
        customerId: input.customerId,
        itemId: line.itemId,
        emptyOwed: line.quantity,
        securityHeld: 0,
      },
    });
  }

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "DeliveryChallan",
    entityId: input.documentNo,
    after: {
      documentNo: input.documentNo,
      customer: [customer.code, customer.name].filter(Boolean).join(" - "),
      customerId: input.customerId,
      challanDate: input.challanDate,
      locationId: input.locationId,
      transporterId: input.transporterId,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      remarks: input.remarks,
      lines: lines.map((line) => {
        const item = itemById.get(line.itemId);
        return {
          itemId: line.itemId,
          item: item ? [item.code, item.name].filter(Boolean).join(" - ") : line.itemId,
          quantity: line.quantity,
          remarks: line.remarks,
        };
      }),
    },
  });

  return { challan, stockEntries };
}

export async function listDeliveryChallansForUser(
  tx: Tx,
  userId: string,
  input: {
    companyId: string;
    financialYearId: string;
    from?: string | Date;
    to?: string | Date;
    status?: DeliveryChallanStatus;
    customerId?: string;
    limit?: number;
    offset?: number;
    search?: string;
  },
) {
  await enforcePermission(tx, userId, "delivery-challan", PermissionAction.VIEW);

  const where: Prisma.DeliveryChallanWhereInput = {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
  };

  if (input.from || input.to) {
    where.challanDate = {};
    if (input.from) where.challanDate.gte = new Date(input.from);
    if (input.to) where.challanDate.lte = new Date(input.to);
  }
  if (input.status) where.status = input.status;
  if (input.customerId) where.customerId = input.customerId;
  if (input.search?.trim()) {
    where.OR = [
      { documentNo: { contains: input.search.trim(), mode: "insensitive" } },
      { saleIssueNo: { contains: input.search.trim(), mode: "insensitive" } },
      { remarks: { contains: input.search.trim(), mode: "insensitive" } },
    ];
  }

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const [rows, total] = await Promise.all([
    tx.deliveryChallan.findMany({
      where,
      orderBy: [{ challanDate: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
      include: {
        lines: true,
        _count: { select: { lines: true } },
      },
    }),
    tx.deliveryChallan.count({ where }),
  ]);

  const customerIds = [...new Set(rows.map((row) => row.customerId))];
  const customers = await tx.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, code: true, name: true },
  });
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  return {
    total,
    challans: rows.map((row) => {
      const customer = customerById.get(row.customerId);
      return {
        ...row,
        customerName: customer ? [customer.code, customer.name].filter(Boolean).join(" - ") : row.customerId,
        totalQuantity: row.lines.reduce((sum, line) => sum + line.quantity, 0),
      };
    }),
  };
}

export async function getDeliveryChallan(tx: Tx, companyId: string, idOrDocumentNo: string) {
  const challan = await tx.deliveryChallan.findFirst({
    where: {
      companyId,
      OR: [{ id: idOrDocumentNo }, { documentNo: idOrDocumentNo }],
    },
    include: { lines: true },
  });
  if (!challan) throw new Error("Delivery challan was not found.");
  return challan;
}

export async function listOpenDeliveryChallansForCustomer(tx: Tx, companyId: string, financialYearId: string, customerId: string) {
  return tx.deliveryChallan.findMany({
    where: {
      companyId,
      financialYearId,
      customerId,
      status: DeliveryChallanStatus.DISPATCHED,
    },
    orderBy: { challanDate: "desc" },
    include: { lines: true },
  });
}

export async function cancelDeliveryChallan(tx: Tx, input: CancelDeliveryChallanInput) {
  await enforcePermission(tx, input.userId, "delivery-challan", PermissionAction.DELETE);
  await assertWritableBusinessDate(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    userId: input.userId,
    transactionDate: new Date(),
    allowClosedDayOverride: input.allowClosedDayOverride,
  });

  const challan = await tx.deliveryChallan.findFirst({
    where: { id: input.id, companyId: input.companyId },
    include: { lines: true },
  });
  if (!challan) throw new Error("Delivery challan was not found.");
  if (challan.status !== DeliveryChallanStatus.DISPATCHED) {
    throw new Error("Only dispatched challans can be cancelled.");
  }

  const cancelDate = new Date();
  for (const line of challan.lines) {
    await createStockLedgerEntry(tx, {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      itemId: line.itemId,
      cylinderState: CylinderState.FILLED,
      direction: StockDirection.IN,
      sourceType: StockSourceType.DELIVERY_CHALLAN,
      sourceId: challan.documentNo,
      transactionDate: cancelDate,
      quantity: line.quantity,
      createdById: input.userId,
      partyType: PartyType.CUSTOMER,
      customerId: challan.customerId,
      locationId: challan.locationId ?? undefined,
      remarks: input.remarks ?? "Delivery challan cancelled",
    });

    const balance = await tx.customerCylinderBalance.findUnique({
      where: { customerId_itemId: { customerId: challan.customerId, itemId: line.itemId } },
      select: { emptyOwed: true },
    });
    if (!balance || balance.emptyOwed < line.quantity) {
      throw new Error(`Cannot cancel challan: customer empty owed for item ${line.itemId} is insufficient.`);
    }
    await tx.customerCylinderBalance.update({
      where: { customerId_itemId: { customerId: challan.customerId, itemId: line.itemId } },
      data: { emptyOwed: { decrement: line.quantity } },
    });
  }

  const updated = await tx.deliveryChallan.update({
    where: { id: challan.id },
    data: {
      status: DeliveryChallanStatus.CANCELLED,
      remarks: input.remarks ?? challan.remarks,
    },
    include: { lines: true },
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    action: "UPDATE",
    entityType: "DeliveryChallan",
    entityId: challan.documentNo,
    after: { status: DeliveryChallanStatus.CANCELLED, remarks: input.remarks },
  });

  return updated;
}

export async function markDeliveryChallanInvoiced(
  tx: Tx,
  input: { companyId: string; challanId: string; saleIssueNo: string },
) {
  const challan = await tx.deliveryChallan.findFirst({
    where: { id: input.challanId, companyId: input.companyId },
    include: { lines: true },
  });
  if (!challan) throw new Error("Delivery challan was not found.");
  if (challan.status !== DeliveryChallanStatus.DISPATCHED) {
    throw new Error("Only dispatched challans can be invoiced.");
  }

  return tx.deliveryChallan.update({
    where: { id: challan.id },
    data: {
      status: DeliveryChallanStatus.INVOICED,
      saleIssueNo: input.saleIssueNo,
    },
    include: { lines: true },
  });
}

/** Aggregate item quantities from challan lines. */
export function challanQuantityByItem(lines: Array<{ itemId: string; quantity: number }>) {
  const map = new Map<string, number>();
  for (const line of lines) {
    map.set(line.itemId, (map.get(line.itemId) ?? 0) + line.quantity);
  }
  return map;
}

/**
 * Sale lines must cover exactly the challan item quantities (whole-challan invoice).
 */
export function assertSaleMatchesChallan(
  challanLines: Array<{ itemId: string; quantity: number }>,
  saleLines: Array<{ itemId: string; quantity: number }>,
) {
  const expected = challanQuantityByItem(challanLines);
  const actual = challanQuantityByItem(saleLines);
  if (expected.size !== actual.size) {
    throw new Error("Sale lines must match the delivery challan items exactly.");
  }
  for (const [itemId, qty] of expected) {
    if (actual.get(itemId) !== qty) {
      throw new Error(`Sale quantity for item ${itemId} must equal challan quantity (${qty}).`);
    }
  }
}
