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

type CustomerOpeningInput = {
  customerId: string;
  amount: string | number;
  transactionDate: string | Date;
  balanceType?: string;
};

type VendorOpeningInput = {
  vendorId: string;
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

async function customerAccount(tx: Tx, companyId: string, customerId: string) {
  const customer = await tx.customer.findFirst({
    where: { id: customerId, companyId, status: "ACTIVE" },
    select: { id: true, code: true, name: true, accountId: true, account: { select: { id: true, code: true, name: true } } },
  });
  if (!customer) throw new Error("customerId must reference an active customer.");
  return customer;
}

async function vendorAccount(tx: Tx, companyId: string, vendorId: string) {
  const vendor = await tx.vendor.findFirst({
    where: { id: vendorId, companyId, status: "ACTIVE" },
    select: { id: true, code: true, name: true, accountId: true, account: { select: { id: true, code: true, name: true } } },
  });
  if (!vendor) throw new Error("vendorId must reference an active vendor.");
  return vendor;
}

async function vendorHasLaterTransactions(tx: Tx, companyId: string, financialYearId: string, accountId: string, openingDate: Date, excludeVoucherId?: string) {
  const count = await tx.accountingVoucherLine.count({
    where: {
      accountId,
      voucher: {
        companyId,
        financialYearId,
        sourceType: { not: "VendorOpeningBalance" },
        voucherDate: { gt: openingDate },
        ...(excludeVoucherId ? { NOT: { id: excludeVoucherId } } : {}),
      },
    },
  });
  return count > 0;
}

async function serializeVendorOpeningVoucher(tx: Tx, voucherId: string) {
  const voucher = await tx.accountingVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    include: { lines: { include: { account: { select: { id: true, code: true, name: true } } }, orderBy: { sortOrder: "asc" } } },
  });
  const vendor = await tx.vendor.findFirst({
    where: { companyId: voucher.companyId, accountId: { in: voucher.lines.map((line) => line.accountId) } },
    select: { id: true, code: true, name: true, accountId: true },
  });
  const vendorLine = vendor ? voucher.lines.find((line) => line.accountId === vendor.accountId) : undefined;
  const locked = vendorLine ? await vendorHasLaterTransactions(tx, voucher.companyId, voucher.financialYearId, vendorLine.accountId, voucher.voucherDate, voucher.id) : true;
  return {
    id: voucher.id,
    voucherNo: voucher.voucherNo,
    voucherDate: voucher.voucherDate,
    amount: voucher.totalDebit,
    balanceType: vendorLine && Number(vendorLine.debit) > 0 ? "DEBIT" : "CREDIT",
    vendorId: vendor?.id ?? "",
    vendor: vendor ? { id: vendor.id, code: vendor.code, name: vendor.name } : null,
    locked,
  };
}

async function customerHasLaterTransactions(tx: Tx, companyId: string, financialYearId: string, accountId: string, openingDate: Date, excludeVoucherId?: string) {
  const count = await tx.accountingVoucherLine.count({
    where: {
      accountId,
      voucher: {
        companyId,
        financialYearId,
        sourceType: { not: "CustomerOpeningBalance" },
        voucherDate: { gt: openingDate },
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

async function serializeCustomerOpeningVoucher(tx: Tx, voucherId: string) {
  const voucher = await tx.accountingVoucher.findUniqueOrThrow({
    where: { id: voucherId },
    include: { lines: { include: { account: { select: { id: true, code: true, name: true } } }, orderBy: { sortOrder: "asc" } } },
  });
  const customer = await tx.customer.findFirst({
    where: { companyId: voucher.companyId, accountId: { in: voucher.lines.map((line) => line.accountId) } },
    select: { id: true, code: true, name: true, accountId: true },
  });
  const customerLine = customer ? voucher.lines.find((line) => line.accountId === customer.accountId) : undefined;
  const locked = customerLine ? await customerHasLaterTransactions(tx, voucher.companyId, voucher.financialYearId, customerLine.accountId, voucher.voucherDate, voucher.id) : true;
  return {
    id: voucher.id,
    voucherNo: voucher.voucherNo,
    voucherDate: voucher.voucherDate,
    amount: voucher.totalDebit,
    balanceType: customerLine && Number(customerLine.debit) > 0 ? "DEBIT" : "CREDIT",
    customerId: customer?.id ?? "",
    customer: customer ? { id: customer.id, code: customer.code, name: customer.name } : null,
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

export async function listCustomerOpeningBalances(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customer-ledger", PermissionAction.VIEW);
    const vouchers = await tx.accountingVoucher.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "CustomerOpeningBalance" },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
      take: 100,
    });
    return Promise.all(vouchers.map((voucher) => serializeCustomerOpeningVoucher(tx, voucher.id)));
  });
}

export async function listCustomerOpeningCustomers(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customer-ledger", PermissionAction.VIEW);
    return tx.customer.findMany({
      where: { companyId: context.companyId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
      take: 200,
    });
  });
}

export async function createCustomerOpeningBalance(context: Context, input: CustomerOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customer-ledger", PermissionAction.CREATE);
    const customer = await customerAccount(tx, context.companyId, input.customerId);
    const existingCount = await tx.accountingVoucherLine.count({
      where: {
        accountId: customer.accountId,
        voucher: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "CustomerOpeningBalance" },
      },
    });
    if (existingCount > 0) throw new Error("Customer opening balance already exists.");
    const amount = positiveDecimal(input.amount, "amount");
    const sourceId = await nextDocumentNumberInTransaction(tx, { companyId: context.companyId, financialYearId: context.financialYearId, prefix: "COB" });
    const equityAccountId = await openingEquityAccount(tx, context.companyId);
    const balanceType = input.balanceType === "CREDIT" ? "CREDIT" : "DEBIT";
    const voucher = await createBalancedVoucher(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      voucherNo: sourceId,
      voucherType: VoucherType.OPENING,
      voucherDate: openingDate(input.transactionDate),
      sourceType: "CustomerOpeningBalance",
      sourceId,
      createdById: context.userId,
      narration: "CustomerOpeningBalance",
      lines:
        balanceType === "DEBIT"
          ? [
              { accountId: customer.accountId, debit: amount },
              { accountId: equityAccountId, credit: amount },
            ]
          : [
              { accountId: equityAccountId, debit: amount },
              { accountId: customer.accountId, credit: amount },
            ],
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "CustomerOpeningBalance", entityId: voucher.id, after: { voucherId: voucher.id, customerId: customer.id, amount: amount.toString(), balanceType } });
    return serializeCustomerOpeningVoucher(tx, voucher.id);
  });
}

export async function updateCustomerOpeningBalance(context: Context, id: string, input: CustomerOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customer-ledger", PermissionAction.UPDATE);
    const before = await tx.accountingVoucher.findFirstOrThrow({
      where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "CustomerOpeningBalance" },
      include: { lines: true },
    });
    const currentCustomer = await tx.customer.findFirst({ where: { companyId: context.companyId, accountId: { in: before.lines.map((line) => line.accountId) } }, select: { id: true, accountId: true } });
    if (!currentCustomer || (await customerHasLaterTransactions(tx, context.companyId, context.financialYearId, currentCustomer.accountId, before.voucherDate, id))) throw new Error("Customer opening balance is locked because later transactions exist.");
    const customer = await customerAccount(tx, context.companyId, input.customerId);
    if (customer.accountId !== currentCustomer.accountId) {
      const existingCount = await tx.accountingVoucherLine.count({
        where: {
          accountId: customer.accountId,
          voucher: { companyId: context.companyId, financialYearId: context.financialYearId },
        },
      });
      if (existingCount > 0) throw new Error("Customer opening balance can only be moved to a customer without accounting movement.");
    }
    const amount = positiveDecimal(input.amount, "amount");
    const equityAccountId = before.lines.find((line) => line.accountId !== currentCustomer.accountId)?.accountId ?? (await openingEquityAccount(tx, context.companyId));
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
                  { accountId: customer.accountId, debit: amount, credit: 0, sortOrder: 1 },
                  { accountId: equityAccountId, debit: 0, credit: amount, sortOrder: 2 },
                ]
              : [
                  { accountId: equityAccountId, debit: amount, credit: 0, sortOrder: 1 },
                  { accountId: customer.accountId, debit: 0, credit: amount, sortOrder: 2 },
                ],
        },
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "CustomerOpeningBalance", entityId: id, before, after: { voucherId: voucher.id, customerId: customer.id, amount: amount.toString(), balanceType } });
    return serializeCustomerOpeningVoucher(tx, id);
  });
}

export async function deleteCustomerOpeningBalance(context: Context, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customer-ledger", PermissionAction.DELETE);
    const before = await tx.accountingVoucher.findFirstOrThrow({
      where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "CustomerOpeningBalance" },
      include: { lines: true },
    });
    const customer = await tx.customer.findFirst({ where: { companyId: context.companyId, accountId: { in: before.lines.map((line) => line.accountId) } }, select: { accountId: true } });
    if (!customer || (await customerHasLaterTransactions(tx, context.companyId, context.financialYearId, customer.accountId, before.voucherDate, id))) throw new Error("Customer opening balance is locked because later transactions exist.");
    await tx.accountingVoucherLine.deleteMany({ where: { voucherId: id } });
    await tx.accountingVoucher.delete({ where: { id } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.DELETE, entityType: "CustomerOpeningBalance", entityId: id, before });
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

export async function listVendorOpeningBalances(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vendors", PermissionAction.VIEW);
    const vouchers = await tx.accountingVoucher.findMany({
      where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "VendorOpeningBalance" },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
      select: { id: true },
      take: 100,
    });
    return Promise.all(vouchers.map((voucher) => serializeVendorOpeningVoucher(tx, voucher.id)));
  });
}

export async function listVendorOpeningVendors(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vendors", PermissionAction.VIEW);
    return tx.vendor.findMany({
      where: { companyId: context.companyId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
      take: 200,
    });
  });
}

export async function createVendorOpeningBalance(context: Context, input: VendorOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vendors", PermissionAction.CREATE);
    const vendor = await vendorAccount(tx, context.companyId, input.vendorId);
    const existingCount = await tx.accountingVoucherLine.count({
      where: {
        accountId: vendor.accountId,
        voucher: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "VendorOpeningBalance" },
      },
    });
    if (existingCount > 0) throw new Error("Vendor opening balance already exists.");
    const amount = positiveDecimal(input.amount, "amount");
    const sourceId = await nextDocumentNumberInTransaction(tx, { companyId: context.companyId, financialYearId: context.financialYearId, prefix: "VOB" });
    const equityAccountId = await openingEquityAccount(tx, context.companyId);
    const balanceType = input.balanceType === "DEBIT" ? "DEBIT" : "CREDIT";
    const voucher = await createBalancedVoucher(tx, {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      voucherNo: sourceId,
      voucherType: VoucherType.OPENING,
      voucherDate: openingDate(input.transactionDate),
      sourceType: "VendorOpeningBalance",
      sourceId,
      createdById: context.userId,
      narration: "VendorOpeningBalance",
      lines:
        balanceType === "DEBIT"
          ? [
              { accountId: vendor.accountId, debit: amount },
              { accountId: equityAccountId, credit: amount },
            ]
          : [
              { accountId: equityAccountId, debit: amount },
              { accountId: vendor.accountId, credit: amount },
            ],
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "VendorOpeningBalance", entityId: voucher.id, after: { voucherId: voucher.id, vendorId: vendor.id, amount: amount.toString(), balanceType } });
    return serializeVendorOpeningVoucher(tx, voucher.id);
  });
}

export async function updateVendorOpeningBalance(context: Context, id: string, input: VendorOpeningInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vendors", PermissionAction.UPDATE);
    const before = await tx.accountingVoucher.findFirstOrThrow({
      where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "VendorOpeningBalance" },
      include: { lines: true },
    });
    const currentVendor = await tx.vendor.findFirst({ where: { companyId: context.companyId, accountId: { in: before.lines.map((line) => line.accountId) } }, select: { id: true, accountId: true } });
    if (!currentVendor || (await vendorHasLaterTransactions(tx, context.companyId, context.financialYearId, currentVendor.accountId, before.voucherDate, id))) throw new Error("Vendor opening balance is locked because later transactions exist.");
    const vendor = await vendorAccount(tx, context.companyId, input.vendorId);
    if (vendor.accountId !== currentVendor.accountId) {
      const existingCount = await tx.accountingVoucherLine.count({
        where: {
          accountId: vendor.accountId,
          voucher: { companyId: context.companyId, financialYearId: context.financialYearId },
        },
      });
      if (existingCount > 0) throw new Error("Vendor opening balance can only be moved to a vendor without accounting movement.");
    }
    const amount = positiveDecimal(input.amount, "amount");
    const equityAccountId = before.lines.find((line) => line.accountId !== currentVendor.accountId)?.accountId ?? (await openingEquityAccount(tx, context.companyId));
    const balanceType = input.balanceType === "DEBIT" ? "DEBIT" : "CREDIT";
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
                  { accountId: vendor.accountId, debit: amount, credit: 0, sortOrder: 1 },
                  { accountId: equityAccountId, debit: 0, credit: amount, sortOrder: 2 },
                ]
              : [
                  { accountId: equityAccountId, debit: amount, credit: 0, sortOrder: 1 },
                  { accountId: vendor.accountId, debit: 0, credit: amount, sortOrder: 2 },
                ],
        },
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "VendorOpeningBalance", entityId: id, before, after: { voucherId: voucher.id, vendorId: vendor.id, amount: amount.toString(), balanceType } });
    return serializeVendorOpeningVoucher(tx, id);
  });
}

export async function deleteVendorOpeningBalance(context: Context, id: string) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vendors", PermissionAction.DELETE);
    const before = await tx.accountingVoucher.findFirstOrThrow({
      where: { id, companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "VendorOpeningBalance" },
      include: { lines: true },
    });
    const vendor = await tx.vendor.findFirst({ where: { companyId: context.companyId, accountId: { in: before.lines.map((line) => line.accountId) } }, select: { accountId: true } });
    if (!vendor || (await vendorHasLaterTransactions(tx, context.companyId, context.financialYearId, vendor.accountId, before.voucherDate, id))) throw new Error("Vendor opening balance is locked because later transactions exist.");
    await tx.accountingVoucherLine.deleteMany({ where: { voucherId: id } });
    await tx.accountingVoucher.delete({ where: { id } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.DELETE, entityType: "VendorOpeningBalance", entityId: id, before });
    return { id };
  });
}

type ExpenseOpeningInput = {
  accountId: string;
  amount: string | number;
  transactionDate: string | Date;
  balanceType?: string;
};

export async function createExpenseAccountOpeningBalance(tx: Tx, context: Context, input: ExpenseOpeningInput) {
  const amount = positiveDecimal(input.amount, "openingBalance");
  const existingCount = await tx.accountingVoucherLine.count({
    where: {
      accountId: input.accountId,
      voucher: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "ExpenseOpeningBalance" },
    },
  });
  if (existingCount > 0) throw new Error("Expense opening balance already exists.");
  const voucherNo = await nextDocumentNumberInTransaction(tx, {
    companyId: context.companyId,
    financialYearId: context.financialYearId,
    prefix: "EOB",
  });
  const equityAccountId = await openingEquityAccount(tx, context.companyId);
  const balanceType = input.balanceType === "CREDIT" ? "CREDIT" : "DEBIT";
  return createBalancedVoucher(tx, {
    companyId: context.companyId,
    financialYearId: context.financialYearId,
    voucherNo,
    voucherType: VoucherType.OPENING,
    voucherDate: openingDate(input.transactionDate),
    sourceType: "ExpenseOpeningBalance",
    sourceId: input.accountId,
    createdById: context.userId,
    narration: "ExpenseOpeningBalance",
    lines:
      balanceType === "DEBIT"
        ? [
            { accountId: input.accountId, debit: amount },
            { accountId: equityAccountId, credit: amount },
          ]
        : [
            { accountId: equityAccountId, debit: amount },
            { accountId: input.accountId, credit: amount },
          ],
  });
}

export async function loadExpenseOpeningBalances(tx: Tx, context: Context, accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, { openingAmount: string; openingBalanceType: string }>();
  const vouchers = await tx.accountingVoucher.findMany({
    where: {
      companyId: context.companyId,
      financialYearId: context.financialYearId,
      sourceType: "ExpenseOpeningBalance",
      sourceId: { in: accountIds },
    },
    include: { lines: true },
  });
  return new Map(
    vouchers.map((voucher) => {
      const accountLine = voucher.lines.find((line) => line.accountId === voucher.sourceId);
      return [
        voucher.sourceId,
        {
          openingAmount: voucher.totalDebit.toString(),
          openingBalanceType: accountLine && Number(accountLine.debit) > 0 ? "DEBIT" : "CREDIT",
        },
      ] as const;
    }),
  );
}
