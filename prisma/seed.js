const { PrismaClient, PermissionAction, AccountType, NormalBalance } = require("@prisma/client");
const { scryptSync, randomBytes } = require("node:crypto");

const prisma = new PrismaClient();

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
  // --- Bulk / import / dollar / plant extension ---
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
  const company = await prisma.company.upsert({
    where: { id: "seed-company-lpg-management-system" },
    update: {},
    create: {
      id: "seed-company-lpg-management-system",
      legalName: "LPG Management System",
      tradeName: "LPG Management System",
      baseCurrency: "PKR",
      locale: "en-PK",
      timeZone: "Asia/Karachi",
      stockAvailableCheck: true,
      workingDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: false },
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

  for (const module of modules) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action },
      });
    }
  }

  const adminRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Admin" } },
    update: {},
    create: { companyId: company.id, name: "Admin", isSystem: true, description: "Full system access." },
  });

  const operatorRole = await prisma.role.upsert({
    where: { companyId_name: { companyId: company.id, name: "Shop Operator" } },
    update: {},
    create: { companyId: company.id, name: "Shop Operator", isSystem: true, description: "Daily LPG sales, returns, receipts, and reports." },
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: adminRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const operatorModules = new Set(["dashboard", "customers", "items", "sale-lpg", "cylinder-returns", "cash-receipts", "stock-ledger", "customer-ledger", "reports"]);
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
    where: { companyId_loginId: { companyId: company.id, loginId: "admin" } },
    update: { financialYearId: financialYear.id, passwordHash: hashPassword("4784Shani") },
    create: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: "Administrator",
      loginId: "admin",
      email: "admin@lpg-management.local",
      passwordHash: hashPassword("4784Shani"),
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

  // --- Bulk / import / dollar / plant control accounts ---
  await upsertAccount(company.id, "2003002001", "Bulk LPG Stock", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  await upsertAccount(company.id, "2003003001", "Bulk Stock In Transit", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  await upsertAccount(company.id, "3001002001", "Bulk LPG Sales", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "3001003001", "Inventory Gain", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "3002001001", "Exchange Gain", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "4001003001", "Freight and Transport", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);
  await upsertAccount(company.id, "4001004001", "Inventory Loss", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);
  await upsertAccount(company.id, "4002001001", "Exchange Loss", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);

  await prisma.company.update({
    where: { id: company.id },
    data: { tradeName: "LPG Management System" },
  });
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
