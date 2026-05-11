const { PrismaClient, PermissionAction, AccountType, NormalBalance, CylinderState, StockDirection, StockSourceType } = require("@prisma/client");
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
  "purchase-filled-cylinders",
  "sale-lpg",
  "cylinder-conversions",
  "empty-sales",
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
    where: { id: "seed-company-hasnan" },
    update: {},
    create: {
      id: "seed-company-hasnan",
      legalName: "Hasnan Traders",
      tradeName: "Hasnan Traders LPG",
      ownerName: "Hasnan Ahmed",
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
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  const operatorModules = new Set(["dashboard", "customers", "items", "sale-lpg", "cylinder-returns", "cash-receipts", "stock-ledger", "customer-ledger", "reports"]);
  for (const permission of allPermissions.filter((permission) => operatorModules.has(permission.module) && [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.PRINT].includes(permission.action))) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: operatorRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: operatorRole.id, permissionId: permission.id },
    });
  }

  const admin = await prisma.user.upsert({
    where: { companyId_loginId: { companyId: company.id, loginId: "admin" } },
    update: { financialYearId: financialYear.id },
    create: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: "Administrator",
      loginId: "admin",
      email: "admin@hasnan.local",
      passwordHash: hashPassword("ChangeMe@123"),
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

  const creditors = await upsertAccount(company.id, "1001001000", "Trade Creditors and Suppliers", AccountType.LIABILITY, NormalBalance.CREDIT, 2, liabilities.id, true);
  await upsertAccount(company.id, "1001002001", "Cylinder Security Liability", AccountType.LIABILITY, NormalBalance.CREDIT, 3, liabilities.id);
  await upsertAccount(company.id, "1001003001", "GST Payable", AccountType.LIABILITY, NormalBalance.CREDIT, 3, liabilities.id);

  await upsertAccount(company.id, "2003001001", "LPG Stock and Stores", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  const cash = await upsertAccount(company.id, "2003010001", "Cash in Hand", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  await upsertAccount(company.id, "2003014001", "HBL Bank Account", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);
  const debtors = await upsertAccount(company.id, "2004001000", "Trade Debtors and Customers", AccountType.ASSET, NormalBalance.DEBIT, 2, assets.id, true);
  await upsertAccount(company.id, "2004003001", "GST Receivable", AccountType.ASSET, NormalBalance.DEBIT, 3, assets.id);

  await upsertAccount(company.id, "3001001001", "Retail Sales LPG", AccountType.REVENUE, NormalBalance.CREDIT, 3, revenue.id);
  await upsertAccount(company.id, "4001002001", "Cost of Goods Sold LPG", AccountType.EXPENSE, NormalBalance.DEBIT, 3, expenses.id);

  const city = await prisma.city.upsert({
    where: { companyId_name: { companyId: company.id, name: "Lahore" } },
    update: {},
    create: { companyId: company.id, name: "Lahore" },
  });

  const area = await prisma.area.upsert({
    where: { cityId_name: { cityId: city.id, name: "Main Market" } },
    update: {},
    create: { companyId: company.id, cityId: city.id, name: "Main Market" },
  });

  const cylinders = await prisma.category.upsert({
    where: { companyId_name: { companyId: company.id, name: "Cylinders" } },
    update: {},
    create: { companyId: company.id, name: "Cylinders", isSystemProtected: true },
  });

  const pso = await prisma.brand.upsert({
    where: { companyId_name: { companyId: company.id, name: "PSO" } },
    update: {},
    create: { companyId: company.id, name: "PSO" },
  });

  const starterItem = await prisma.item.upsert({
    where: { companyId_code: { companyId: company.id, code: "CYL-11.8-PSO" } },
    update: {},
    create: {
      companyId: company.id,
      code: "CYL-11.8-PSO",
      name: "11.8 KG PSO Cylinder",
      categoryId: cylinders.id,
      brandId: pso.id,
      cylinderWeightKg: "11.80",
      defaultSecurity: "0",
    },
  });

  const openingStock = await prisma.stockLedgerEntry.findFirst({
    where: { companyId: company.id, financialYearId: financialYear.id, sourceId: "SEED-OPENING-CYL-11.8-PSO" },
  });
  if (!openingStock) {
    await prisma.stockLedgerEntry.create({
      data: {
        companyId: company.id,
        financialYearId: financialYear.id,
        itemId: starterItem.id,
        cylinderState: CylinderState.FILLED,
        direction: StockDirection.IN,
        sourceType: StockSourceType.OPENING_BALANCE,
        sourceId: "SEED-OPENING-CYL-11.8-PSO",
        transactionDate: financialYear.startsOn,
        quantity: 1000,
        balanceAfter: 1000,
        createdById: admin.id,
        remarks: "Seed opening filled cylinder stock for local development and repeatable test fixtures.",
      },
    });
  }

  const vendorAccount = await upsertAccount(company.id, "1001001001", "PSO Supplier", AccountType.LIABILITY, NormalBalance.CREDIT, 3, creditors.id);
  await prisma.vendor.upsert({
    where: { companyId_code: { companyId: company.id, code: "V-0001" } },
    update: {},
    create: { companyId: company.id, code: "V-0001", name: "PSO Supplier", accountId: vendorAccount.id },
  });

  const customerAccount = await upsertAccount(company.id, "2004001001", "Walk-in LPG Customer", AccountType.ASSET, NormalBalance.DEBIT, 3, debtors.id);
  await prisma.customer.upsert({
    where: { companyId_code: { companyId: company.id, code: "C-0001" } },
    update: {},
    create: { companyId: company.id, code: "C-0001", name: "Walk-in LPG Customer", cityId: city.id, areaId: area.id, accountId: customerAccount.id },
  });

  await prisma.bank.upsert({
    where: { companyId_name: { companyId: company.id, name: "HBL" } },
    update: {},
    create: { companyId: company.id, name: "HBL", accountId: cash.id },
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
