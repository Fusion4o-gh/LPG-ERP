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
  cityId?: string;
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

async function ensureConfigNameUnique(tx: Tx, model: "city" | "area" | "brand" | "category", companyId: string, value: string, id?: string, cityId?: string) {
  const where =
    model === "area"
      ? { cityId: cityId as string, name: { equals: value, mode: "insensitive" as const }, ...(id ? { NOT: { id } } : {}) }
      : { companyId, name: { equals: value, mode: "insensitive" as const }, ...(id ? { NOT: { id } } : {}) };
  const existing =
    model === "city"
      ? await tx.city.findFirst({ where, select: { id: true } })
      : model === "area"
        ? await tx.area.findFirst({ where, select: { id: true } })
        : model === "brand"
          ? await tx.brand.findFirst({ where, select: { id: true } })
          : await tx.category.findFirst({ where, select: { id: true } });
  if (existing) throw new Error("name already exists.");
}

async function ensureExpenseTypeUnique(tx: Tx, companyId: string, accountCode: string, accountName: string, id?: string) {
  const duplicateCode = await tx.chartAccount.findFirst({ where: { companyId, code: accountCode, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (duplicateCode) throw new Error("code already exists.");
  const duplicateName = await tx.chartAccount.findFirst({
    where: { companyId, accountType: AccountType.EXPENSE, name: { equals: accountName, mode: "insensitive" }, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (duplicateName) throw new Error("name already exists.");
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

export async function listCities(context: Context, includeAll = false) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.VIEW);
    return tx.city.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    });
  });
}

export async function createCity(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.CREATE);
    const cityName = name(input.name);
    await ensureConfigNameUnique(tx, "city", context.companyId, cityName);
    const city = await tx.city.create({ data: { companyId: context.companyId, name: cityName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "City", entityId: city.id, after: city });
    return city;
  });
}

export async function updateCity(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.UPDATE);
    const before = await tx.city.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const cityName = name(input.name);
    await ensureConfigNameUnique(tx, "city", context.companyId, cityName, id);
    const city = await tx.city.update({ where: { id }, data: { name: cityName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "City", entityId: id, before, after: city });
    return city;
  });
}

export async function listAreas(context: Context, includeAll = false) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.VIEW);
    return tx.area.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
      orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
      select: { id: true, cityId: true, name: true, status: true, city: { select: { name: true } } },
    });
  });
}

async function resolveCity(tx: Tx, companyId: string, cityId?: string) {
  if (!cityId?.trim()) throw new Error("cityId is required.");
  const city = await tx.city.findFirst({ where: { id: cityId, companyId } });
  if (!city) throw new Error("cityId is invalid.");
  return city;
}

export async function createArea(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.CREATE);
    const city = await resolveCity(tx, context.companyId, input.cityId);
    const areaName = name(input.name);
    await ensureConfigNameUnique(tx, "area", context.companyId, areaName, undefined, city.id);
    const area = await tx.area.create({ data: { companyId: context.companyId, cityId: city.id, name: areaName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Area", entityId: area.id, after: area });
    return area;
  });
}

export async function updateArea(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "customers", PermissionAction.UPDATE);
    const before = await tx.area.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const city = await resolveCity(tx, context.companyId, input.cityId);
    const areaName = name(input.name);
    await ensureConfigNameUnique(tx, "area", context.companyId, areaName, id, city.id);
    const area = await tx.area.update({ where: { id }, data: { cityId: city.id, name: areaName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Area", entityId: id, before, after: area });
    return area;
  });
}

export async function listBrands(context: Context, includeAll = false) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.VIEW);
    return tx.brand.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    });
  });
}

export async function createBrand(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.CREATE);
    const brandName = name(input.name);
    await ensureConfigNameUnique(tx, "brand", context.companyId, brandName);
    const brand = await tx.brand.create({ data: { companyId: context.companyId, name: brandName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Brand", entityId: brand.id, after: brand });
    return brand;
  });
}

export async function updateBrand(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.UPDATE);
    const before = await tx.brand.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const brandName = name(input.name);
    await ensureConfigNameUnique(tx, "brand", context.companyId, brandName, id);
    const brand = await tx.brand.update({ where: { id }, data: { name: brandName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Brand", entityId: id, before, after: brand });
    return brand;
  });
}

export async function listCategories(context: Context, includeAll = false) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.VIEW);
    return tx.category.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, isSystemProtected: true },
    });
  });
}

export async function createCategory(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.CREATE);
    const categoryName = name(input.name);
    await ensureConfigNameUnique(tx, "category", context.companyId, categoryName);
    const category = await tx.category.create({ data: { companyId: context.companyId, name: categoryName, status: cleanStatus(input.status) } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Category", entityId: category.id, after: category });
    return category;
  });
}

export async function updateCategory(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "items", PermissionAction.UPDATE);
    const before = await tx.category.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const categoryName = name(input.name);
    const categoryStatus = cleanStatus(input.status);
    if (before.isSystemProtected && (before.name !== categoryName || categoryStatus !== RecordStatus.ACTIVE)) {
      throw new Error("System-protected categories cannot be renamed or deactivated.");
    }
    await ensureConfigNameUnique(tx, "category", context.companyId, categoryName, id);
    const category = await tx.category.update({ where: { id }, data: { name: categoryName, status: categoryStatus } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Category", entityId: id, before, after: category });
    return category;
  });
}

async function findExpenseParent(tx: Tx, companyId: string, parentId?: string) {
  if (parentId?.trim()) {
    const parent = await tx.chartAccount.findFirst({ where: { id: parentId, companyId, accountType: AccountType.EXPENSE } });
    if (!parent) throw new Error("parentId is invalid.");
    return parent;
  }
  const parent = await tx.chartAccount.findFirst({
    where: { companyId, accountType: AccountType.EXPENSE, parentId: null },
    orderBy: { code: "asc" },
  });
  if (!parent) throw new Error("Expense parent account is missing.");
  return parent;
}

export async function listExpenseTypes(context: Context, includeAll = false) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "chart-of-accounts", PermissionAction.VIEW);
    return tx.chartAccount.findMany({
      where: { companyId: context.companyId, accountType: AccountType.EXPENSE, status: includeAll ? undefined : RecordStatus.ACTIVE },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, parentId: true, level: true, accountType: true, normalBalance: true, isSystem: true, status: true, parent: { select: { name: true } } },
      take: 200,
    });
  });
}

export async function createExpenseType(context: Context, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "chart-of-accounts", PermissionAction.CREATE);
    const accountCode = code(input.code);
    const accountName = name(input.name);
    await ensureExpenseTypeUnique(tx, context.companyId, accountCode, accountName);
    const parent = await findExpenseParent(tx, context.companyId, input.parentId);
    const account = await tx.chartAccount.create({
      data: {
        companyId: context.companyId,
        code: accountCode,
        name: accountName,
        parentId: parent.id,
        level: parent.level + 1,
        accountType: AccountType.EXPENSE,
        normalBalance: NormalBalance.DEBIT,
        status: cleanStatus(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "ExpenseType", entityId: account.id, after: account });
    return account;
  });
}

export async function updateExpenseType(context: Context, id: string, input: MasterInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "chart-of-accounts", PermissionAction.UPDATE);
    const before = await tx.chartAccount.findFirstOrThrow({ where: { id, companyId: context.companyId, accountType: AccountType.EXPENSE } });
    if (before.isSystem || before.isControl) throw new Error("System or control expense accounts cannot be edited here.");
    const accountCode = code(input.code);
    const accountName = name(input.name);
    await ensureExpenseTypeUnique(tx, context.companyId, accountCode, accountName, id);
    const parent = await findExpenseParent(tx, context.companyId, input.parentId);
    const account = await tx.chartAccount.update({
      where: { id },
      data: { code: accountCode, name: accountName, parentId: parent.id, level: parent.level + 1, status: cleanStatus(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "ExpenseType", entityId: id, before, after: account });
    return account;
  });
}
