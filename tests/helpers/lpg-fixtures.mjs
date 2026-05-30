import { AccountType, NormalBalance } from "@prisma/client";
import { SEED_COMPANY_NAME } from "./test-database.mjs";

export { SEED_COMPANY_NAME };

export function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const TEST_CATEGORY = "Test LPG Category";
const TEST_BRAND = "Test PSO";
const TEST_ITEM_CODE = "CYL-11.8-PSO";
const TEST_CUSTOMER_CODE = "C-0001";
const TEST_VENDOR_CODE = "V-0001";
const TEST_BANK_NAME = "HBL";

async function findControlAccount(prisma, companyId, contains) {
  return prisma.chartAccount.findFirstOrThrow({
    where: { companyId, name: { contains, mode: "insensitive" }, status: "ACTIVE" },
    orderBy: { code: "asc" },
  });
}

async function ensureBankGlAccount(prisma, companyId) {
  const existing = await prisma.chartAccount.findFirst({
    where: { companyId, name: { contains: "Bank Account", mode: "insensitive" }, status: "ACTIVE" },
    orderBy: { code: "asc" },
  });
  if (existing) return existing;

  const assets = await prisma.chartAccount.findFirstOrThrow({ where: { companyId, code: "2000000000" } });
  return prisma.chartAccount.upsert({
    where: { companyId_code: { companyId, code: "2003020001" } },
    update: {},
    create: {
      companyId,
      code: "2003020001",
      name: "Bank Account Test",
      parentId: assets.id,
      level: 3,
      accountType: AccountType.ASSET,
      normalBalance: NormalBalance.DEBIT,
      isSystem: true,
    },
  });
}

export async function ensureTestMasterData(prisma, companyId) {
  const category = await prisma.category.upsert({
    where: { companyId_name: { companyId, name: TEST_CATEGORY } },
    update: {},
    create: { companyId, name: TEST_CATEGORY },
  });

  const brand = await prisma.brand.upsert({
    where: { companyId_name: { companyId, name: TEST_BRAND } },
    update: {},
    create: { companyId, name: TEST_BRAND },
  });

  const seedItem = await prisma.item.upsert({
    where: { companyId_code: { companyId, code: TEST_ITEM_CODE } },
    update: {},
    create: {
      companyId,
      code: TEST_ITEM_CODE,
      name: "11.8kg PSO Cylinder",
      categoryId: category.id,
      brandId: brand.id,
      cylinderWeightKg: 11.8,
      defaultSecurity: 5000,
    },
  });

  const debtors = await findControlAccount(prisma, companyId, "Trade Debtors");
  const seedCustomer = await prisma.customer.upsert({
    where: { companyId_code: { companyId, code: TEST_CUSTOMER_CODE } },
    update: {},
    create: {
      companyId,
      code: TEST_CUSTOMER_CODE,
      name: "Test Customer",
      accountId: debtors.id,
    },
  });

  const creditors = await findControlAccount(prisma, companyId, "Trade Creditors");
  const seedVendor = await prisma.vendor.upsert({
    where: { companyId_code: { companyId, code: TEST_VENDOR_CODE } },
    update: {},
    create: {
      companyId,
      code: TEST_VENDOR_CODE,
      name: "Test Vendor",
      accountId: creditors.id,
    },
  });

  const bankGl = await ensureBankGlAccount(prisma, companyId);
  const bank = await prisma.bank.upsert({
    where: { companyId_name: { companyId, name: TEST_BANK_NAME } },
    update: {},
    create: { companyId, name: TEST_BANK_NAME, accountId: bankGl.id },
  });

  return { seedItem, seedCustomer, seedVendor, bank };
}

export async function seedContext(prisma) {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: SEED_COMPANY_NAME } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({
    where: { companyId: company.id, isActive: true, isClosed: false },
  });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  return { company, financialYear, user };
}

export async function baseFixture(prisma) {
  const { company, financialYear, user } = await seedContext(prisma);
  const master = await ensureTestMasterData(prisma, company.id);
  return { company, financialYear, user, ...master };
}

export async function createIsolatedItem(prisma, companyId, seedItem, prefix = "T-ITEM") {
  return prisma.item.create({
    data: {
      companyId,
      code: doc(prefix),
      name: `${prefix} Cylinder`,
      categoryId: seedItem.categoryId,
      brandId: seedItem.brandId,
    },
  });
}

export async function createIsolatedCustomer(prisma, companyId, seedCustomer, prefix = "T-C") {
  return prisma.customer.create({
    data: {
      companyId,
      code: doc(prefix),
      name: `${prefix} Customer`,
      accountId: seedCustomer.accountId,
    },
  });
}

export async function createIsolatedVendor(prisma, companyId, seedVendor, prefix = "T-V") {
  return prisma.vendor.create({
    data: {
      companyId,
      code: doc(prefix),
      name: `${prefix} Vendor`,
      accountId: seedVendor.accountId,
    },
  });
}

export async function isolatedFixture(prisma, prefix = "T") {
  const base = await baseFixture(prisma);
  const item = await createIsolatedItem(prisma, base.company.id, base.seedItem, `${prefix}-ITEM`);
  const customer = await createIsolatedCustomer(prisma, base.company.id, base.seedCustomer, `${prefix}-C`);
  const vendor = await createIsolatedVendor(prisma, base.company.id, base.seedVendor, `${prefix}-V`);
  return { ...base, item, customer, vendor };
}
