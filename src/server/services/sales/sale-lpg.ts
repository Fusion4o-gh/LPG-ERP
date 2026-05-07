import { CylinderState, PartyType, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { ACCOUNT_CODES, getAccountIdByCode } from "../accounting/accounts.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { assertWritableBusinessDate } from "../inventory/day-closing.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type SaleInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  issueNo: string;
  customerId: string;
  itemId: string;
  quantity: number;
  unitPrice: string | number;
  gstAmount?: string | number;
  securityDepositAmount?: string | number;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

type BatchInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  batchNo: string;
  sales: Omit<SaleInput, "companyId" | "financialYearId" | "userId">[];
  allowClosedDayOverride?: boolean;
};

async function createSaleInTransaction(tx: Prisma.TransactionClient, input: SaleInput) {
  await assertWritableBusinessDate(tx, input);

  const customer = await tx.customer.findUniqueOrThrow({ where: { id: input.customerId }, select: { accountId: true } });
  const salesAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.sales);
  const gstPayableAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.gstPayable);
  const securityLiabilityAccountId = await getAccountIdByCode(tx, input.companyId, ACCOUNT_CODES.securityLiability);

  const saleAmount = new Prisma.Decimal(input.unitPrice).times(input.quantity);
  const gstAmount = new Prisma.Decimal(input.gstAmount ?? 0);
  const securityAmount = new Prisma.Decimal(input.securityDepositAmount ?? 0);
  const receivableAmount = saleAmount.plus(gstAmount).plus(securityAmount);

  const stockEntry = await createStockLedgerEntry(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    itemId: input.itemId,
    cylinderState: CylinderState.FILLED,
    direction: StockDirection.OUT,
    sourceType: StockSourceType.SALE_LPG,
    sourceId: input.issueNo,
    transactionDate: input.transactionDate,
    quantity: input.quantity,
    createdById: input.userId,
    partyType: PartyType.CUSTOMER,
    customerId: input.customerId,
  });

  await tx.customerCylinderBalance.upsert({
    where: { customerId_itemId: { customerId: input.customerId, itemId: input.itemId } },
    update: {
      emptyOwed: { increment: input.quantity },
      securityHeld: { increment: securityAmount },
    },
    create: {
      customerId: input.customerId,
      itemId: input.itemId,
      emptyOwed: input.quantity,
      securityHeld: securityAmount,
    },
  });

  const voucher = await createBalancedVoucher(tx, {
    companyId: input.companyId,
    financialYearId: input.financialYearId,
    voucherNo: input.issueNo,
    voucherType: VoucherType.SR,
    voucherDate: input.transactionDate,
    sourceType: "SaleLpg",
    sourceId: input.issueNo,
    createdById: input.userId,
    lines: [
      { accountId: customer.accountId, debit: receivableAmount },
      { accountId: salesAccountId, credit: saleAmount },
      ...(gstAmount.gt(0) ? [{ accountId: gstPayableAccountId, credit: gstAmount }] : []),
      ...(securityAmount.gt(0) ? [{ accountId: securityLiabilityAccountId, credit: securityAmount }] : []),
    ],
  });

  await writeAuditLog(tx, {
    companyId: input.companyId,
    userId: input.userId,
    entityType: "SaleLpg",
    entityId: input.issueNo,
    after: { ...input, unitPrice: String(input.unitPrice), gstAmount: String(input.gstAmount ?? 0) },
  });

  return { voucher, stockEntries: [stockEntry] };
}

export async function saleLpgSingle(input: SaleInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "sale-lpg", PermissionAction.CREATE);
    return createSaleInTransaction(tx, input);
  });
}

export async function saleLpgCompleteDayBatch(input: BatchInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, input.userId, "sale-lpg", PermissionAction.CREATE);

    const sales = [];
    for (const sale of input.sales) {
      sales.push(
        await createSaleInTransaction(tx, {
          ...sale,
          companyId: input.companyId,
          financialYearId: input.financialYearId,
          userId: input.userId,
          allowClosedDayOverride: input.allowClosedDayOverride,
        }),
      );
    }

    await writeAuditLog(tx, {
      companyId: input.companyId,
      userId: input.userId,
      entityType: "CompleteDaySaleBatch",
      entityId: input.batchNo,
      after: { batchNo: input.batchNo, count: input.sales.length },
    });

    return { sales };
  });
}
