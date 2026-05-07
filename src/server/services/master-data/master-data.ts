import { AccountType, AuditAction, NormalBalance, PermissionAction, RecordStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = Prisma.TransactionClient;
type Context = { companyId: string; financialYearId: string; userId: string };
type Status = keyof typeof RecordStatus;

type MasterInput = {
  id?: string;
  code?: string;
  name: string;
  phone?: string;
  cell?: string;
  address?: string;
  status?: Status;
  cylinderWeightKg?: number;
  defaultSecurity?: number;
  parentId?: string;
  accountType?: string;
  normalBalance?: string;
};

function cleanStatus(status?: Status) {
  return status === "INACTIVE" ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
}

function code(value?: string) {
  if (!value?.trim()) throw new Error("code is required.");
  return value.trim().toUpperCase();
}

function name(value?: string) {
  if (!value?.trim()) throw new Error("name is required.");
  return value.trim();
}

async function ensureUnique(tx: Tx, model: "customer" | "vendor" | "item", companyId: string, field: "code" | "name", value: string, id?: string) {
  const where = { companyId, [field]: value, ...(id ? { NOT: { id } } : {}) };
  const existing =
    model === "customer"
      ? await tx.customer.findFirst({ where, select: { id: true } })
      : model === "vendor"
        ? await tx.vendor.findFirst({ where, select: { id: true } })
        : await tx.item.findFirst({ where, select: { id: true } });
  if (existing) throw new Error(`${field} already exists.`);
}

async function findAccount(tx: Tx, companyId: string, contains: string) {
  const account = await tx.chartAccount.findFirst({
    where: { companyId, name: { contains, mode: "insensitive" }, status: "ACTIVE" },
    orderBy: { code: "asc" },
  });
  if (!account) throw new Error(`Required ${contains} control account is missing.`);
  return account;
}

async function findCategory(tx: Tx, companyId: string) {
  const category = await tx.category.findFirst({ where: { companyId, status: "ACTIVE" }, orderBy: { name: "asc" } });
  if (!category) throw new Error("At least one item category is required.");
  return category;
}

export async function createCustomer(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.CREATE);
    const customerCode = code(input.code);
    const customerName = name(input.name);
    await ensureUnique(tx, "customer", context.companyId, "code", customerCode);
    const account = await findAccount(tx, context.companyId, "Trade Debtors");
    const customer = await tx.customer.create({
      data: {
        companyId: context.companyId,
        code: customerCode,
        name: customerName,
        phone: input.phone,
        cell: input.cell,
        address: input.address,
        accountId: account.id,
        status: cleanStatus(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Customer", entityId: customer.id, after: customer });
    return customer;
  });
}

export async function updateCustomer(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.UPDATE);
    const before = await tx.customer.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const customerCode = code(input.code);
    await ensureUnique(tx, "customer", context.companyId, "code", customerCode, id);
    const customer = await tx.customer.update({
      where: { id },
      data: { code: customerCode, name: name(input.name), phone: input.phone, cell: input.cell, address: input.address, status: cleanStatus(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Customer", entityId: id, before, after: customer });
    return customer;
  });
}

export async function createVendor(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vendors", PermissionAction.CREATE);
    const vendorCode = code(input.code);
    await ensureUnique(tx, "vendor", context.companyId, "code", vendorCode);
    const account = await findAccount(tx, context.companyId, "Trade Creditors");
    const vendor = await tx.vendor.create({
      data: { companyId: context.companyId, code: vendorCode, name: name(input.name), phone: input.phone, cell: input.cell, address: input.address, accountId: account.id, status: cleanStatus(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Vendor", entityId: vendor.id, after: vendor });
    return vendor;
  });
}

export async function updateVendor(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vendors", PermissionAction.UPDATE);
    const before = await tx.vendor.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const vendorCode = code(input.code);
    await ensureUnique(tx, "vendor", context.companyId, "code", vendorCode, id);
    const vendor = await tx.vendor.update({
      where: { id },
      data: { code: vendorCode, name: name(input.name), phone: input.phone, cell: input.cell, address: input.address, status: cleanStatus(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Vendor", entityId: id, before, after: vendor });
    return vendor;
  });
}

export async function createItem(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.CREATE);
    const itemCode = code(input.code);
    await ensureUnique(tx, "item", context.companyId, "code", itemCode);
    const category = await findCategory(tx, context.companyId);
    const item = await tx.item.create({
      data: {
        companyId: context.companyId,
        code: itemCode,
        name: name(input.name),
        categoryId: category.id,
        cylinderWeightKg: input.cylinderWeightKg,
        defaultSecurity: input.defaultSecurity ?? 0,
        status: cleanStatus(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Item", entityId: item.id, after: item });
    return item;
  });
}

export async function updateItem(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.UPDATE);
    const before = await tx.item.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const itemCode = code(input.code);
    await ensureUnique(tx, "item", context.companyId, "code", itemCode, id);
    const item = await tx.item.update({
      where: { id },
      data: { code: itemCode, name: name(input.name), cylinderWeightKg: input.cylinderWeightKg, defaultSecurity: input.defaultSecurity ?? 0, status: cleanStatus(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Item", entityId: id, before, after: item });
    return item;
  });
}

export async function createBank(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "banks", PermissionAction.CREATE);
    const bankName = name(input.name);
    const duplicate = await tx.bank.findFirst({ where: { companyId: context.companyId, name: bankName }, select: { id: true } });
    if (duplicate) throw new Error("name already exists.");
    const account = await findAccount(tx, context.companyId, "Bank Account");
    const bank = await tx.bank.create({ data: { companyId: context.companyId, name: bankName, accountId: account.id, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Bank", entityId: bank.id, after: bank });
    return bank;
  });
}

export async function updateBank(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "banks", PermissionAction.UPDATE);
    const before = await tx.bank.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const bankName = name(input.name);
    const duplicate = await tx.bank.findFirst({ where: { companyId: context.companyId, name: bankName, NOT: { id } }, select: { id: true } });
    if (duplicate) throw new Error("name already exists.");
    const bank = await tx.bank.update({ where: { id }, data: { name: bankName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Bank", entityId: id, before, after: bank });
    return bank;
  });
}

function accountType(value?: string) {
  if (!value || !Object.values(AccountType).includes(value as AccountType)) throw new Error("accountType is required.");
  return value as AccountType;
}

function normalBalance(value?: string) {
  if (!value || !Object.values(NormalBalance).includes(value as NormalBalance)) throw new Error("normalBalance is required.");
  return value as NormalBalance;
}

export async function createChartAccount(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "chart-of-accounts", PermissionAction.CREATE);
    const accountCode = code(input.code);
    const duplicate = await tx.chartAccount.findFirst({ where: { companyId: context.companyId, code: accountCode }, select: { id: true } });
    if (duplicate) throw new Error("code already exists.");
    const parent = input.parentId ? await tx.chartAccount.findFirst({ where: { id: input.parentId, companyId: context.companyId } }) : null;
    const account = await tx.chartAccount.create({
      data: {
        companyId: context.companyId,
        code: accountCode,
        name: name(input.name),
        parentId: parent?.id,
        level: parent ? parent.level + 1 : 1,
        accountType: accountType(input.accountType),
        normalBalance: normalBalance(input.normalBalance),
        status: cleanStatus(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "ChartAccount", entityId: account.id, after: account });
    return account;
  });
}

export async function updateChartAccount(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "chart-of-accounts", PermissionAction.UPDATE);
    const before = await tx.chartAccount.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const accountCode = code(input.code);
    const duplicate = await tx.chartAccount.findFirst({ where: { companyId: context.companyId, code: accountCode, NOT: { id } }, select: { id: true } });
    if (duplicate) throw new Error("code already exists.");
    const account = await tx.chartAccount.update({
      where: { id },
      data: {
        code: accountCode,
        name: name(input.name),
        accountType: accountType(input.accountType),
        normalBalance: normalBalance(input.normalBalance),
        status: cleanStatus(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "ChartAccount", entityId: id, before, after: account });
    return account;
  });
}
