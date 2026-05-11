import { AccountType, AuditAction, CylinderState, NormalBalance, PermissionAction, Prisma, StockDirection, StockSourceType, VoucherType, type Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { createBalancedVoucher } from "../accounting/vouchers.ts";
import { nextDocumentNumberInTransaction } from "../accounting/document-numbers.ts";
import { createStockLedgerEntry } from "../inventory/stock-ledger.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = PrismaTypes.TransactionClient;
type Context = { companyId: string; financialYearId: string; userId: string };

type ShopOpeningInput = {
  itemId: string;
  cylinderState: string;
  quantity: number;
  transactionDate: string | Date;
};

type CashOpeningInput = {
  accountId: string;
  amount: string | number;
  transactionDate: string | Date;
  balanceType?: string;
};

function positiveInteger(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer.`);
  return value;
}

function positiveDecimal(value: string | number, field: string) {
  const amount = new Prisma.Decimal(value);
  if (!amount.isFinite() || amount.lte(0)) throw new Error(`${field} must be a positive number.`);
  return amount;
}

function openingState(value: string) {
  if (value === CylinderState.FILLED || value === CylinderState.EMPTY) return value;
  throw new Error("type must be Filled or Empty.");
}

function openingDate(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("date must be valid.");
  return date;
}

async function ensureItem(tx: Tx, companyId: string, itemId: string) {
  return tx.item.findFirstOrThrow({ where: { id: itemId, companyId }, select: { id: true, code: true, name: true } });
}

async function stockMovementCount(tx: Tx, companyId: string, financialYearId: string, itemId: string, cylinderState: CylinderState, excludeId?: string) {
  return tx.stockLedgerEntry.count({
    where: {
      companyId,
      financialYearId,
      itemId,
      cylinderState,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
}

async function stockHasTransactions(tx: Tx, companyId: string, financialYearId: string, itemId: string, cylinderState: CylinderState, excludeId?: string) {
  const count = await tx.stockLedgerEntry.count({
    where: {
      companyId,
      financialYearId,
      itemId,
      cylinderState,
      sourceType: { not: StockSourceType.OPENING_BALANCE },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return count > 0;
}

async function cashAccount(tx: Tx, companyId: string, accountId: string) {
  const account = await tx.chartAccount.findFirst({
    where: { id: accountId, companyId, accountType: AccountType.ASSET, status: "ACTIVE", name: { contains: "Cash", mode: "insensitive" } },
    select: { id: true, code: true, name: true },
  });
  if (!account) throw new Error("accountId must be an active cash asset account.");
  return account;
}

async function openingEquityAccount(tx: Tx, companyId: string) {
  const existing = await tx.chartAccount.findFirst({
    where: { companyId, accountType: AccountType.EQUITY, name: "Opening Balance Equity" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const root =
    (await tx.chartAccount.findFirst({ where: { companyId, accountType: AccountType.EQUITY, parentId: null }, select: { id: true } })) ??
    (await tx.chartAccount.create({
      data: {
        companyId,
        code: "5000000000",
        name: "Equity",
        level: 1,
        accountType: AccountType.EQUITY,
        normalBalance: NormalBalance.CREDIT,
        isSystem: true,
      },
      select: { id: true },
    }));
  const equity = await tx.chartAccount.create({
    data: {
      companyId,
      code: "5001001001",
      name: "Opening Balance Equity",
      parentId: root.id,
      level: 2,
      accountType: AccountType.EQUITY,
      normalBalance: NormalBalance.CREDIT,
      isSystem: true,
    },
    select: { id: true },
  });
  return equity.id;
}

async function cashHasTransactions(tx: Tx, companyId: string, financialYearId: string, accountId: string, excludeVoucherId?: string) {
  const count = await tx.accountingVoucherLine.count({
    where: {
      accountId,
      voucher: {
        companyId,
        financialYearId,
        sourceType: { not: "CashOpening" },
        ...(excludeVoucherId ? { NOT: { id: excludeVoucherId } } : {}),
      },
    },
  });
  return count > 0;
}

async function serializeShopEntry(tx: Tx, entry: { id: string; companyId: string; financialYearId: string; itemId: string; cylinderState: CylinderState }) {
  const locked = await stockHasTransactions(tx, entry.companyId, entry.financialYearId, entry.itemId, entry.cylinderState, entry.id);
  const full = await tx.stockLedgerEntry.findUniqueOrThrow({
    where: { id: entry.id },
    include: { item: { select: { code: true, name: true } } },
  });
  return { ...full, locked };
}

async function serializeCashVoucher(tx: Tx, voucherId: string) {
  const voucher = await tx.accountingVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    include: { lines: { include: { account: { select: { id: true, code: true, name: true } } }, orderBy: { sortOrder: "asc" } } },
  });
  const cashLine = voucher.lines.find((line) => /cash/i.test(line.account.name));
  const locked = cashLine ? await cashHasTransactions(tx, voucher.companyId, voucher.financialYearId, cashLine.accountId, voucher.id) : true;
  return {
    id: voucher.id,
    voucherNo: voucher.voucherNo,
    voucherDate: voucher.voucherDate,
    amount: voucher.totalDebit,
    balanceType: cashLine && Number(cashLine.debit) > 0 ? "DEBIT" : "CREDIT",
    accountId: cashLine?.accountId ?? "",
    account: cashLine?.account ?? null,
    locked,
  };
}

export async function listShopOpeningBalances(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "stock-ledger", PermissionAction.VIEW);
    const entries = await tx.stockLedgerEntry.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: StockSourceType.OPENING_BALANCE },
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      include: { item: { select: { code: true, name: true } } },
      take: 200,
    });
    return Promise.all(entries.map(async (entry) => ({ ...entry, locked: await stockHasTransactions(tx, context.companyId, context.financialYearId, entry.itemId, entry.cylinderState, entry.id) })));
  });
}

export async function createShopOpeningBalance(context: Context, input: ShopOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "stock-ledger", PermissionAction.CREATE);
    const item = await ensureItem(tx, context.companyId, input.itemId);
    const cylinderState = openingState(input.cylinderState);
    const existingCount = await stockMovementCount(tx, context.companyId, context.financialYearId, item.id, cylinderState);
    if (existingCount > 0) throw new Error("Opening stock can only be added before stock movement exists for this item and type.");
    const sourceId = await nextDocumentNumberInTransaction(tx, { companyId: context.companyId, financialYearId: context.financialYearId, prefix: "SOB" });
    const entry = await createStockLedgerEntry(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      itemId: item.id,
      cylinderState,
      direction: StockDirection.IN,
      sourceType: StockSourceType.OPENING_BALANCE,
      sourceId,
      transactionDate: openingDate(input.transactionDate),
      quantity: positiveInteger(input.quantity, "quantity"),
      createdById: context.userId,
      remarks: "Shop Opening Balance",
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "ShopOpeningBalance", entityId: entry.id, after: entry });
    return serializeShopEntry(tx, entry);
  });
}

export async function updateShopOpeningBalance(context: Context, id: string, input: ShopOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "stock-ledger", PermissionAction.UPDATE);
    const before = await tx.stockLedgerEntry.findFirstOrThrow({ where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: StockSourceType.OPENING_BALANCE } });
    if (await stockHasTransactions(tx, context.companyId, context.financialYearId, before.itemId, before.cylinderState, id)) throw new Error("Opening stock is locked because transactions exist.");
    const item = await ensureItem(tx, context.companyId, input.itemId);
    const cylinderState = openingState(input.cylinderState);
    const existingCount = await stockMovementCount(tx, context.companyId, context.financialYearId, item.id, cylinderState, id);
    if (existingCount > 0) throw new Error("Opening stock can only be edited before stock movement exists for this item and type.");
    const entry = await tx.stockLedgerEntry.update({
      where: { id },
      data: { itemId: item.id, cylinderState, quantity: positiveInteger(input.quantity, "quantity"), balanceAfter: positiveInteger(input.quantity, "quantity"), transactionDate: openingDate(input.transactionDate) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "ShopOpeningBalance", entityId: id, before, after: entry });
    return serializeShopEntry(tx, entry);
  });
}

export async function deleteShopOpeningBalance(context: Context, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "stock-ledger", PermissionAction.DELETE);
    const before = await tx.stockLedgerEntry.findFirstOrThrow({ where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: StockSourceType.OPENING_BALANCE } });
    if (await stockHasTransactions(tx, context.companyId, context.financialYearId, before.itemId, before.cylinderState, id)) throw new Error("Opening stock is locked because transactions exist.");
    await tx.stockLedgerEntry.delete({ where: { id } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.DELETE, entityType: "ShopOpeningBalance", entityId: id, before });
    return { id };
  });
}

export async function listCashOpeningBalances(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "journal-vouchers", PermissionAction.VIEW);
    const vouchers = await tx.accountingVoucher.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "CashOpening" },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
      take: 100,
    });
    return Promise.all(vouchers.map((voucher) => serializeCashVoucher(tx, voucher.id)));
  });
}

export async function listCashOpeningAccounts(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "journal-vouchers", PermissionAction.VIEW);
    return tx.chartAccount.findMany({
      where: { companyId: context.companyId, accountType: AccountType.ASSET, status: "ACTIVE", name: { contains: "Cash", mode: "insensitive" } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    });
  });
}

export async function createCashOpeningBalance(context: Context, input: CashOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "journal-vouchers", PermissionAction.CREATE);
    const account = await cashAccount(tx, context.companyId, input.accountId);
    const hasAnyMovement = await tx.accountingVoucherLine.count({ where: { accountId: account.id, voucher: { companyId: context.companyId, financialYearId: context.financialYearId } } });
    if (hasAnyMovement > 0) throw new Error("Cash opening can only be added before accounting movement exists for this account.");
    const amount = positiveDecimal(input.amount, "amount");
    const sourceId = await nextDocumentNumberInTransaction(tx, { companyId: context.companyId, financialYearId: context.financialYearId, prefix: "CO" });
    const equityAccountId = await openingEquityAccount(tx, context.companyId);
    const balanceType = input.balanceType === "CREDIT" ? "CREDIT" : "DEBIT";
    const voucher = await createBalancedVoucher(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      voucherNo: sourceId,
      voucherType: VoucherType.OPENING,
      voucherDate: openingDate(input.transactionDate),
      sourceType: "CashOpening",
      sourceId,
      createdById: context.userId,
      narration: "Cash Opening",
      lines:
        balanceType === "DEBIT"
          ? [
              { accountId: account.id, debit: amount },
              { accountId: equityAccountId, credit: amount },
            ]
          : [
              { accountId: equityAccountId, debit: amount },
              { accountId: account.id, credit: amount },
            ],
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "CashOpening", entityId: voucher.id, after: { voucherId: voucher.id, accountId: account.id, amount: amount.toString(), balanceType } });
    return serializeCashVoucher(tx, voucher.id);
  });
}

export async function updateCashOpeningBalance(context: Context, id: string, input: CashOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "journal-vouchers", PermissionAction.UPDATE);
    const before = await tx.accountingVoucher.findFirstOrThrow({
      where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "CashOpening" },
      include: { lines: { include: { account: { select: { name: true } } } } },
    });
    const currentCashLine = before.lines.find((line) => /cash/i.test(line.account.name));
    if (!currentCashLine || (await cashHasTransactions(tx, context.companyId, context.financialYearId, currentCashLine.accountId, id))) throw new Error("Cash opening is locked because transactions exist.");
    const account = await cashAccount(tx, context.companyId, input.accountId);
    if (account.id !== currentCashLine.accountId) {
      const movementCount = await tx.accountingVoucherLine.count({ where: { accountId: account.id, voucher: { companyId: context.companyId, financialYearId: context.financialYearId } } });
      if (movementCount > 0) throw new Error("Cash opening can only be moved to an account without accounting movement.");
    }
    const amount = positiveDecimal(input.amount, "amount");
    const equityAccountId = before.lines.find((line) => line.accountId !== currentCashLine.accountId)?.accountId ?? (await openingEquityAccount(tx, context.companyId));
    const balanceType = input.balanceType === "CREDIT" ? "CREDIT" : "DEBIT";
    await tx.accountingVoucherLine.deleteMany({ where: { voucherId: id } });
    const voucher = await tx.accountingVoucher.update({
      where: { id },
      data: {
        voucherDate: openingDate(input.transactionDate),
        totalDebit: amount,
        totalCredit: amount,
        lines: {
          create:
            balanceType === "DEBIT"
              ? [
                  { accountId: account.id, debit: amount, credit: 0, sortOrder: 1 },
                  { accountId: equityAccountId, debit: 0, credit: amount, sortOrder: 2 },
                ]
              : [
                  { accountId: equityAccountId, debit: amount, credit: 0, sortOrder: 1 },
                  { accountId: account.id, debit: 0, credit: amount, sortOrder: 2 },
                ],
        },
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "CashOpening", entityId: id, before, after: { voucherId: voucher.id, accountId: account.id, amount: amount.toString(), balanceType } });
    return serializeCashVoucher(tx, id);
  });
}

export async function deleteCashOpeningBalance(context: Context, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "journal-vouchers", PermissionAction.DELETE);
    const before = await tx.accountingVoucher.findFirstOrThrow({
      where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "CashOpening" },
      include: { lines: { include: { account: { select: { name: true } } } } },
    });
    const cashLine = before.lines.find((line) => /cash/i.test(line.account.name));
    if (!cashLine || (await cashHasTransactions(tx, context.companyId, context.financialYearId, cashLine.accountId, id))) throw new Error("Cash opening is locked because transactions exist.");
    await tx.accountingVoucherLine.deleteMany({ where: { voucherId: id } });
    await tx.accountingVoucher.delete({ where: { id } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.DELETE, entityType: "CashOpening", entityId: id, before });
    return { id };
  });
}
