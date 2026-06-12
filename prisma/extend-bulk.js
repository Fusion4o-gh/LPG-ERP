/**
 * Idempotent extension seed for the bulk / import / dollar / plant module.
 *
 * Unlike prisma/seed.js (which is keyed to a fixed demo company id), this script
 * operates on WHATEVER companies and Admin roles already exist in the target
 * database. Safe to run against any environment (local or Neon): it only adds
 * the new permissions, grants them to existing Admin roles, and upserts the new
 * control accounts under each company's existing top-level account tree.
 */
const { PrismaClient, PermissionAction, AccountType, NormalBalance } = require("@prisma/client");

const prisma = new PrismaClient();

const NEW_MODULES = [
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

const ACTIONS = [
  PermissionAction.VIEW,
  PermissionAction.CREATE,
  PermissionAction.UPDATE,
  PermissionAction.DELETE,
  PermissionAction.PRINT,
  PermissionAction.APPROVE,
];

// [code, name, accountType, normalBalance, parentTopLevelCode]
const NEW_ACCOUNTS = [
  ["2003002001", "Bulk LPG Stock", AccountType.ASSET, NormalBalance.DEBIT, "2000000000"],
  ["2003003001", "Bulk Stock In Transit", AccountType.ASSET, NormalBalance.DEBIT, "2000000000"],
  ["3001002001", "Bulk LPG Sales", AccountType.REVENUE, NormalBalance.CREDIT, "3000000000"],
  ["3001003001", "Inventory Gain", AccountType.REVENUE, NormalBalance.CREDIT, "3000000000"],
  ["3002001001", "Exchange Gain", AccountType.REVENUE, NormalBalance.CREDIT, "3000000000"],
  ["4001003001", "Freight and Transport", AccountType.EXPENSE, NormalBalance.DEBIT, "4000000000"],
  ["4001004001", "Inventory Loss", AccountType.EXPENSE, NormalBalance.DEBIT, "4000000000"],
  ["4002001001", "Exchange Loss", AccountType.EXPENSE, NormalBalance.DEBIT, "4000000000"],
];

async function main() {
  // 1. Permissions (global, not company-scoped)
  const permissionRows = [];
  for (const module of NEW_MODULES) {
    for (const action of ACTIONS) {
      const permission = await prisma.permission.upsert({
        where: { module_action: { module, action } },
        update: {},
        create: { module, action },
      });
      permissionRows.push(permission);
    }
  }
  console.log(`Ensured ${permissionRows.length} new permissions.`);

  // 2. Grant ALL permissions to every Admin role (so existing admins keep full access)
  const adminRoles = await prisma.role.findMany({ where: { name: "Admin" }, select: { id: true } });
  const allPermissions = await prisma.permission.findMany({ select: { id: true } });
  for (const role of adminRoles) {
    await prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`Granted all permissions to ${adminRoles.length} Admin role(s).`);

  // 3. Control accounts per existing company, under each company's top-level tree
  const companies = await prisma.company.findMany({ select: { id: true } });
  let accountCount = 0;
  for (const company of companies) {
    for (const [code, name, accountType, normalBalance, parentCode] of NEW_ACCOUNTS) {
      const parent = await prisma.chartAccount.findUnique({
        where: { companyId_code: { companyId: company.id, code: parentCode } },
        select: { id: true, level: true },
      });
      if (!parent) {
        console.warn(`  Company ${company.id}: missing parent ${parentCode}, skipping ${code}.`);
        continue;
      }
      await prisma.chartAccount.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: { name, accountType, normalBalance },
        create: {
          companyId: company.id,
          code,
          name,
          accountType,
          normalBalance,
          level: parent.level + 1,
          parentId: parent.id,
          isSystem: true,
        },
      });
      accountCount++;
    }
  }
  console.log(`Ensured ${accountCount} control accounts across ${companies.length} compan(ies).`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Bulk module extension seed complete.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
