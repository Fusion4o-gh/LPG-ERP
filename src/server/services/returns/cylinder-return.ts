import { ApprovalStatus, AuditAction, CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { capDiscount, postCustomerRefund } from "../accounting/settlement-vouchers.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
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
  itemId?: string;
  quantity?: number;
  returnType?: "Empty" | "Filled" | string;
  unitPrice?: string | number;
  remarks?: string;
  lines?: CylinderReturnLineInput[];
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
  discount?: string | number;
  amountPaid?: string | number;
  payMode?: string;
  bankId?: string;
  chequeNo?: string;
};

type CylinderReturnLineInput = {
  itemId: string;
  returnType?: "Empty" | "Filled" | string;
  quantity: number;
  unitPrice?: string | number;
};

function decimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

function normalizeReturnType(value: string | undefined) {
  return String(value ?? "Empty").toLowerCase() === "filled" ? "Filled" : "Empty";
}

function normalizeLines(input: CylinderReturnInput) {
  const rawLines: CylinderReturnLineInput[] = input.lines?.length
    ? input.lines
    : [
        {
          itemId: input.itemId ?? "",
          returnType: input.returnType ?? "Empty",
          quantity: input.quantity ?? 0,
          unitPrice: input.unitPrice,
        },
      ];

  return rawLines.map((line, index) => {
    if (!line.itemId) throw new Error(`lines[${index}].itemId is required.`);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`lines[${index}].quantity must be a positive integer.`);
    const returnType = normalizeReturnType(line.returnType);
    const unitPrice = decimal(line.unitPrice);
    if (returnType === "Filled" && unitPrice.lte(0)) throw new Error(`lines[${index}].unitPrice must be positive for filled returns.`);
    const amount = returnType === "Filled" ? unitPrice.times(quantity) : new Prisma.Decimal(0);
    return { itemId: line.itemId, returnType, quantity, unitPrice, amount };
  });
}

async function decrementEmptyOwed(tx: Prisma.TransactionClient, customerId: string, itemId: string, quantity: number) {
  const balance = await tx.customerCylinderBalance.findUnique({
    where: { customerId_itemId: { customerId, itemId } },
    select: { emptyOwed: true },
  });
  if (!balance || balance.emptyOwed < quantity) {
    throw new Error("Customer does not owe enough empty cylinders for this return.");
  }
  await tx.customerCylinderBalance.update({
    where: { customerId_itemId: { customerId, itemId } },
    data: { emptyOwed: { decrement: quantity } },
  });
}

export async function cylinderReturn(input: CylinderReturnInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "cylinder-returns", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);

    const lines = normalizeLines(input);
    const itemRows = await tx.item.findMany({
      where: { companyId: input.companyId, id: { in: [...new Set(lines.map((line) => line.itemId))] } },
      select: { id: true, code: true, name: true },
    });
    const itemById = new Map(itemRows.map((item) => [item.id, item]));
    const stockEntries = [];
    const totalAmount = lines.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    const discountAmount = capDiscount(totalAmount, input.discount);
    const netReturnAmount = totalAmount.minus(discountAmount);
    let salesDiscountAccountId: string | null = null;
    try {
      salesDiscountAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.salesDiscount);
    } catch {
      salesDiscountAccountId = null;
    }

    for (const line of lines) {
      const stockEntry = await createStockLedgerEntry(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        itemId: line.itemId,
        cylinderState: line.returnType === "Filled" ? CylinderState.FILLED : CylinderState.EMPTY,
        direction: StockDirection.IN,
        sourceType: StockSourceType.CYLINDER_RETURN,
        sourceId: input.returnNo,
        transactionDate: input.transactionDate,
        quantity: line.quantity,
        createdById: input.userId,
        partyType: PartyType.CUSTOMER,
        customerId: input.customerId,
      });
      stockEntries.push(stockEntry);

      if (line.returnType === "Empty") {
        await decrementEmptyOwed(tx, input.customerId, line.itemId, line.quantity);
      }
    }

    const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
    let voucher = null;
    if (netReturnAmount.gt(0)) {
      const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
      voucher = await createBalancedVoucher(tx, {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        voucherNo: input.returnNo,
        voucherType: VoucherType.JV,
        voucherDate: input.transactionDate,
        narration: input.remarks,
        sourceType: "CylinderReturn",
        sourceId: input.returnNo,
        createdById: input.userId,
        lines: [
          { accountId: salesAccountId, debit: totalAmount },
          ...(discountAmount.gt(0) && salesDiscountAccountId ? [{ accountId: salesDiscountAccountId, debit: discountAmount }] : []),
          { accountId: customer.accountId, credit: netReturnAmount },
        ],
      });
    }

    const amountPaid = decimal(input.amountPaid);
    if (amountPaid.gt(netReturnAmount)) throw new Error("amountPaid cannot exceed net return amount after discount.");
    const refundVoucher = netReturnAmount.gt(0)
      ? await postCustomerRefund(tx, {
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          userId: input.userId,
          transactionDate: input.transactionDate,
          allowClosedDayOverride: input.allowClosedDayOverride,
          partyAccountId: customer.accountId,
          amount: amountPaid,
          payMode: input.payMode,
          bankId: input.bankId,
          chequeNo: input.chequeNo,
        })
      : null;

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "CylinderReturn",
      entityId: input.returnNo,
      after: {
        returnNo: input.returnNo,
        customerId: input.customerId,
        transactionDate: input.transactionDate,
        remarks: input.remarks,
        totalAmount: String(totalAmount),
        discountAmount: String(discountAmount),
        netReturnAmount: String(netReturnAmount),
        amountPaid: String(input.amountPaid ?? 0),
        payMode: input.payMode ?? "Credit",
        lines: lines.map((line) => {
          const item = itemById.get(line.itemId);
          const gstPercent = line.returnType === "Filled" ? new Prisma.Decimal(5) : new Prisma.Decimal(0);
          const exGstAmount = line.amount;
          const gstAmount = line.returnType === "Filled" ? exGstAmount.times(gstPercent).div(100) : new Prisma.Decimal(0);
          const totalAmount = exGstAmount.plus(gstAmount);
          return {
            itemId: line.itemId,
            item: item ? [item.code, item.name].filter(Boolean).join(" - ") : line.itemId,
            returnType: line.returnType,
            cylinderState: line.returnType === "Filled" ? CylinderState.FILLED : CylinderState.EMPTY,
            direction: StockDirection.IN,
            quantity: line.quantity,
            unitPrice: String(line.unitPrice),
            gstPercent: String(gstPercent),
            gstAmount: String(gstAmount),
            exGstAmount: String(exGstAmount),
            amount: String(exGstAmount),
            totalAmount: String(totalAmount),
          };
        }),
      },
    });

    return {
      returnNo: input.returnNo,
      stockEntries,
      voucher,
      refundVoucher,
      totalAmount,
      discountAmount,
      netReturnAmount,
      amountPaid,
    };
  });
}

export async function requestValuedCylinderReturn(input: CylinderReturnInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "cylinder-returns", PermissionAction.CREATE);
    await assertWritableBusinessDate(tx, input);
    const lines = normalizeLines(input);
    const totalAmount = lines.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
    if (totalAmount.lte(0)) throw new Error("Approval is only required for valued cylinder returns.");
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, companyId: input.companyId }, select: { id: true } });
    if (!customer) throw new Error("customerId is invalid.");
    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const itemCount = await tx.item.count({ where: { companyId: input.companyId, id: { in: itemIds } } });
    if (itemCount !== itemIds.length) throw new Error("One or more return items are invalid.");
    const payload = {
      returnNo: input.returnNo,
      customerId: input.customerId,
      transactionDate: new Date(input.transactionDate).toISOString(),
      remarks: input.remarks ?? null,
      lines: lines.map((line) => ({ itemId: line.itemId, returnType: line.returnType, quantity: line.quantity, unitPrice: line.unitPrice.toString() })),
      discount: input.discount ?? 0,
      amountPaid: input.amountPaid ?? 0,
      payMode: input.payMode ?? null,
      bankId: input.bankId ?? null,
      chequeNo: input.chequeNo ?? null,
    };
    const approval = await tx.cylinderReturnApproval.create({ data: { companyId: input.companyId, financialYearId: input.financialYearId, returnNo: input.returnNo, customerId: input.customerId, transactionDate: new Date(input.transactionDate), totalAmount, payload, requestedById: input.userId } });
    await writeAuditLog(tx, { companyId: input.companyId, userId: input.userId, entityType: "CylinderReturnApproval", entityId: approval.id, after: approval });
    return { approvalId: approval.id, returnNo: input.returnNo, status: approval.status, totalAmount };
  });
}

export async function listValuedCylinderReturnApprovals(context: { companyId: string; financialYearId: string; userId: string }) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "cylinder-returns", PermissionAction.VIEW);
    const rows = await tx.cylinderReturnApproval.findMany({ where: { companyId: context.companyId, financialYearId: context.financialYearId }, orderBy: [{ status: "asc" }, { transactionDate: "desc" }], take: 300 });
    const customers = await tx.customer.findMany({ where: { companyId: context.companyId, id: { in: rows.map((row) => row.customerId) } }, select: { id: true, name: true, code: true } });
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    return rows.map((row) => ({ id: row.id, returnNo: row.returnNo, transactionDate: row.transactionDate.toISOString().slice(0, 10), customer: customerById.get(row.customerId) ? [customerById.get(row.customerId)?.code, customerById.get(row.customerId)?.name].filter(Boolean).join(" - ") : row.customerId, totalAmount: row.totalAmount.toString(), status: row.status }));
  });
}

export async function approveValuedCylinderReturn(context: { companyId: string; financialYearId: string; userId: string }, id: string) {
  const approval = await prisma.cylinderReturnApproval.findFirst({ where: { id, companyId: context.companyId, financialYearId: context.financialYearId } });
  if (!approval) throw new Error("Valued cylinder return approval was not found.");
  if (approval.status !== ApprovalStatus.PENDING) throw new Error("Only pending valued cylinder returns can be approved.");
  const payload = approval.payload as Record<string, any>;
  const result = await cylinderReturn({ ...payload, ...context, returnNo: approval.returnNo, transactionDate: String(payload.transactionDate), lines: payload.lines, discount: payload.discount, amountPaid: payload.amountPaid, payMode: payload.payMode ?? undefined, bankId: payload.bankId ?? undefined, chequeNo: payload.chequeNo ?? undefined } as CylinderReturnInput);
  await prisma.$transaction(async (tx) => {
    const row = await tx.cylinderReturnApproval.update({ where: { id }, data: { status: ApprovalStatus.APPROVED, approvedById: context.userId, approvedAt: new Date() } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "CylinderReturnApproval", entityId: id, before: approval, after: row });
  });
  return { ...result, approvalId: id, status: ApprovalStatus.APPROVED };
}

export async function rejectValuedCylinderReturn(context: { companyId: string; financialYearId: string; userId: string }, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "cylinder-returns", PermissionAction.APPROVE);
    const before = await tx.cylinderReturnApproval.findFirst({ where: { id, companyId: context.companyId, financialYearId: context.financialYearId } });
    if (!before) throw new Error("Valued cylinder return approval was not found.");
    if (before.status !== ApprovalStatus.PENDING) throw new Error("Only pending valued cylinder returns can be rejected.");
    const row = await tx.cylinderReturnApproval.update({ where: { id }, data: { status: ApprovalStatus.DISAPPROVED, approvedById: context.userId, approvedAt: new Date() } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "CylinderReturnApproval", entityId: id, before, after: row });
    return { approvalId: id, returnNo: row.returnNo, status: row.status };
  });
}
