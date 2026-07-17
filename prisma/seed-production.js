/**
 * Production bootstrap for Hasnan Traders.
 * Requires SEED_ADMIN_PASSWORD. Creates company, FY, RBAC, admin user, and COA only.
 * Does not create customers, vendors, items, or transactions.
 *
 * Usage:
 *   SEED_ADMIN_PASSWORD='...' DATABASE_URL='...' node prisma/seed-production.js
 */
const { PrismaClient, PermissionAction, AccountType, NormalBalance } = require("@prisma/client");
const { scryptSync, randomBytes } = require("node:crypto");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: (() => {
        const url = process.env.DATABASE_URL?.trim();
        if (!url) {
          console.error("DATABASE_URL is required.");
          process.exit(1);
        }
        if (/localhost|127\.0\.0\.1/i.test(url)) {
          console.error("Refusing to run production seed against a local DATABASE_URL.");
          process.exit(1);
        }
        return url;
      })(),
    },
  },
});

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD?.trim();
if (!SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 12) {
  console.error("SEED_ADMIN_PASSWORD is required and must be at least 12 characters.");
  process.exit(1);
}

const COMPANY_ID = "seed-company-hasnan-traders";
const COMPANY_NAME = "Hasnan Traders";
const ADMIN_LOGIN_ID = "HasnanTraders";
const ADMIN_NAME = "Hasnan Traders";

const modules = [
  "dashboard",
  "company",
  "financial-years",
  "rbac",
  "chart-of-accounts",
  "customers",
  "vendors",
  "items",
  "banks",
  "purchase-filled-cylinders",
  "sale-lpg",
  "cylinder-conversions",
  "empty-sales",
  "decanting-sales",
  "cylinder-returns",
  "cash-receipts",
  "cash-payments",
  "bank-receipts",
  "bank-payments",
  "journal-vouchers",
  "stock-ledger",
  "customer-ledger",
  "reports",
  "day-closing",
  "day-closing.override",
  "audit-log",
  "transporters",
  "vehicles",
  "drivers",
  "plants",
  "stock-locations",
  "bulk-products",
  "bulk-opening-stock",
  "opening-voucher",
  "import-contracts",
  "loadings",
  "purchase-contracts",
  "sale-contracts",
  "local-purchase",
  "delivered-sale",
  "plant-decanting",
  "loss-gain",
  "filling-sale",
  "plant-bulk-sale",
  "plant-transfer",
  "partial-receiving",
  "dollar-transactions",
];

const actions = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
  PermissionAction.PRINT,
  PermissionAction.APPROVE,
  PermissionAction.CLOSE_DAY,
  PermissionAction.MANAGE_RBAC,
];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

async function upsertAccount(companyId, code, name, accountType, normalBalance, level, parentId, isControl = false) {
  return prisma.chartAccount.upsert({
    where: { companyId_code: { companyId, code } },
    update: { name, accountType, normalBalance, level, parentId, isControl },
    create: { companyId, code, name, accountType, normalBalance, level, parentId, isControl, isSystem: true },
  });
}

async function main() {
  console.log("Starting Hasnan Traders production bootstrap...");
  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {
      legalName: COMPANY_NAME,
      tradeName: COMPANY_NAME,
      locale: "en-PK",
      timeZone: "Asia/Karachi",
      status: "ACTIVE",
    },
    create: {
      id: COMPANY_ID,
      legalName: COMPANY_NAME,
      tradeName: COMPANY_NAME,
      baseCurrency: "PKR",
      locale: "en-PK",
      timeZone: "Asia/Karachi",
      stockAvailableCheck: true,
      workingDays: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false,
      },
    },
  });

  const financialYear = await prisma.financialYear.upsert({
    where: { companyId_label: { companyId: company.id, label: "2026-27" } },
    update: { isActive: true, isClosed: false },
    create: {
      companyId: company.id,
      label: "2026-27",
      startsOn: new Date("2026-07-01"),
      endsOn: new Date("2027-06-30"),
      isActive: true,
    },
  });

  console.log("Seeding permissions...");
  const permissionRows = [];
  for (const module of modules) {
    for (const action of actions) {
      permissionRows.push({ module, action });
    }
  }
  await prisma.permission.createMany({ data: permissionRows, skipDuplicates: true });

  const adminRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Admin" } },
    update: {},
    create: { companyId: company.id, name: "Admin", isSystem: true, description: "Full system access." },
  });

  const operatorRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Shop Operator" } },
    update: {},
    create: {
      companyId: company.id,
      name: "Shop Operator",
      isSystem: true,
      description: "Daily LPG sales, returns, receipts, and reports.",
    },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: adminRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const operatorModules = new Set([
    "dashboard",
    "customers",
    "items",
    "sale-lpg",
    "cylinder-returns",
    "cash-receipts",
    "stock-ledger",
    "customer-ledger",
    "reports",
  ]);
  const operatorPermissions = allPermissions.filter(
    (permission) =>
      operatorModules.has(permission.module) &&
      [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.PRINT].includes(permission.action),
  );
  await prisma.rolePermission.createMany({
    data: operatorPermissions.map((permission) => ({
      roleId: operatorRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const admin = await prisma.user.upsert({
    where: { companyId_loginId: { companyId: company.id, loginId: ADMIN_LOGIN_ID } },
    update: {
      name: ADMIN_NAME,
      financialYearId: financialYear.id,
      passwordHash: hashPassword(SEED_ADMIN_PASSWORD),
      status: "ACTIVE",
    },
    create: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: ADMIN_NAME,
      loginId: ADMIN_LOGIN_ID,
      email: "admin@hasnantraders.local",
      passwordHash: hashPassword(SEED_ADMIN_PASSWORD),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  const liabilities = await upsertAccount(company.id, "1000000000", "Liabilities", AccountType.LIABILITY, NormalBalance.CREDIT, 1, undefined, true);
  const assets = await upsertAccount(company.id, "2000000000", "Assets", AccountType.ASSET, NormalBalance.DEBIT, 1, undefined, true);
  const revenue = await upsertAccount(company.id, "3000000000", "Sales and Revenue", AccountType.REVENUE, NormalBalance.CREDIT, 1, undefined, true);
  const expenses = await upsertAccount(company.id, "4000000000", "Expenses", AccountType.EXPENSE, NormalBalance.DEBIT, 1, undefined, true);

  await upsertAccount(company.id, "1001001000", "Trade Creditors and Suppliers", AccountType.LIABILITY, NormalBalance.CREDIT, 2, liabilities.id, true);
  await upsertAccount(company.id, "1001002001", "Cylinder Security Liability", AccountType.LIABILITY, NormalBalance.CREDIT, 3, liabilities.id);

  await upsertAccount(company.id, "2003001001", "LPG Stock and Stores", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  await upsertAccount(company.id, "2003010001", "Cash in Hand", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  await upsertAccount(company.id, "2004001000", "Trade Debtors and Customers", AccountType.ASSET, NormalBalance.DEBIT, 2, assets.id, true);
  await upsertAccount(company.id, "2004003001", "GST Receivable", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);

  await upsertAccount(company.id, "3001001001", "Retail Sales LPG", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "4001002001", "Cost of Goods Sold LPG", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);
  await upsertAccount(company.id, "4001001501", "Sales Discount Allowed", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);
  await upsertAccount(company.id, "4001001502", "Purchase Discount Received", AccountType.REVENUE, NormalBalance.CREDIT, 3, expenses.id);

  await upsertAccount(company.id, "2003002001", "Bulk LPG Stock", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  await upsertAccount(company.id, "2003003001", "Bulk Stock In Transit", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  await upsertAccount(company.id, "3001002001", "Bulk LPG Sales", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "3001003001", "Inventory Gain", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "3002001001", "Exchange Gain", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "4001003001", "Freight and Transport", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);
  await upsertAccount(company.id, "4001004001", "Inventory Loss", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);
  await upsertAccount(company.id, "4002001001", "Exchange Loss", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);

  console.log(`Production bootstrap complete: ${COMPANY_NAME} / login ${ADMIN_LOGIN_ID}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
