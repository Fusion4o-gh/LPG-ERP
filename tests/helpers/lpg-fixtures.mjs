export function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function baseFixture(prisma) {
  const company = await prisma.company.findFirstOrThrow({ where: { legalName: "Hasnan Traders" } });
  const financialYear = await prisma.financialYear.findFirstOrThrow({
    where: { companyId: company.id, isActive: true, isClosed: false },
  });
  const user = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, loginId: "admin" } });
  const seedItem = await prisma.item.findFirstOrThrow({ where: { companyId: company.id, code: "CYL-11.8-PSO" } });
  const seedCustomer = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id, code: "C-0001" } });
  const seedVendor = await prisma.vendor.findFirstOrThrow({ where: { companyId: company.id, code: "V-0001" } });
  const bank = await prisma.bank.findFirstOrThrow({ where: { companyId: company.id, name: "HBL" } });
  return { company, financialYear, user, seedItem, seedCustomer, seedVendor, bank };
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
