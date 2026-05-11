import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { baseFixture, doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const masterData = await import("../src/server/services/master-data/master-data.ts");

async function fixture() {
  const base = await baseFixture(prisma);
  return {
    ...base,
    context: { companyId: base.company.id, financialYearId: base.financialYear.id, userId: base.user.id },
  };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("create/edit city writes audit log and prevents duplicates", async () => {
  const { company, context } = await fixture();
  const cityName = doc("City");
  const city = await masterData.createCity(context, { name: cityName });

  assert.equal(city.name, cityName);
  await assert.rejects(masterData.createCity(context, { name: cityName.toLowerCase() }), /name already exists/i);

  const updated = await masterData.updateCity(context, city.id, { name: `${cityName} Updated`, status: "INACTIVE" });
  assert.equal(updated.status, "INACTIVE");

  const auditCount = await prisma.auditLog.count({ where: { companyId: company.id, entityType: "City", entityId: city.id } });
  assert.equal(auditCount, 2);
});

test("create/edit area linked to city", async () => {
  const { context } = await fixture();
  const city = await masterData.createCity(context, { name: doc("Area City") });
  const area = await masterData.createArea(context, { cityId: city.id, name: doc("Area") });

  assert.equal(area.cityId, city.id);
  await assert.rejects(masterData.createArea(context, { cityId: city.id, name: area.name.toLowerCase() }), /name already exists/i);

  const updated = await masterData.updateArea(context, area.id, { cityId: city.id, name: `${area.name} Updated`, status: "INACTIVE" });
  assert.equal(updated.status, "INACTIVE");
});

test("create/edit brand", async () => {
  const { context } = await fixture();
  const brand = await masterData.createBrand(context, { name: doc("Brand") });
  const updated = await masterData.updateBrand(context, brand.id, { name: `${brand.name} Updated`, status: "INACTIVE" });

  assert.equal(updated.status, "INACTIVE");
  await assert.rejects(masterData.createBrand(context, { name: updated.name.toLowerCase() }), /name already exists/i);
});

test("create/edit category and block unsafe protected category edit", async () => {
  const { company, context } = await fixture();
  const category = await masterData.createCategory(context, { name: doc("Category") });
  const updated = await masterData.updateCategory(context, category.id, { name: `${category.name} Updated`, status: "INACTIVE" });
  assert.equal(updated.status, "INACTIVE");

  const protectedCategory = await prisma.category.create({
    data: { companyId: company.id, name: doc("Protected Category"), isSystemProtected: true },
  });
  await assert.rejects(
    masterData.updateCategory(context, protectedCategory.id, { name: `${protectedCategory.name} Updated`, status: "ACTIVE" }),
    /system-protected/i,
  );
});

test("create/edit expense type with account mapping", async () => {
  const { context } = await fixture();
  const parent = await prisma.chartAccount.findFirstOrThrow({
    where: { companyId: context.companyId, accountType: "EXPENSE", parentId: null },
  });
  const expenseType = await masterData.createExpenseType(context, {
    code: doc("4999").slice(0, 20),
    name: doc("Expense"),
    parentId: parent.id,
  });

  assert.equal(expenseType.accountType, "EXPENSE");
  assert.equal(expenseType.normalBalance, "DEBIT");
  assert.equal(expenseType.parentId, parent.id);

  const updated = await masterData.updateExpenseType(context, expenseType.id, {
    code: `${expenseType.code}U`,
    name: `${expenseType.name} Updated`,
    parentId: parent.id,
    status: "INACTIVE",
  });
  assert.equal(updated.status, "INACTIVE");

  await assert.rejects(
    masterData.createExpenseType(context, { code: updated.code, name: doc("Expense Duplicate"), parentId: parent.id }),
    /code already exists/i,
  );
});

test("unauthorized user is denied configuration master-data writes", async () => {
  const { company, financialYear } = await fixture();
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("Config Denied"),
      loginId: doc("config-denied"),
      passwordHash: "test",
    },
  });
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: deniedUser.id };

  await assert.rejects(masterData.createCity(context, { name: doc("Denied City") }), /permission/i);
});

test("configuration list requires view permission", async () => {
  const { company, financialYear } = await fixture();
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("Config Viewer"),
      loginId: doc("config-viewer"),
      passwordHash: "test",
    },
  });
  const role = await prisma.role.create({ data: { companyId: company.id, name: doc("Config Viewer Role") } });
  const permission = await prisma.permission.findUniqueOrThrow({
    where: { module_action: { module: "customers", action: PermissionAction.VIEW } },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });

  const rows = await masterData.listCities({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, true);
  assert.ok(Array.isArray(rows));
  await assert.rejects(masterData.createCity({ companyId: company.id, financialYearId: financialYear.id, userId: user.id }, { name: doc("No Create") }), /permission/i);
});
