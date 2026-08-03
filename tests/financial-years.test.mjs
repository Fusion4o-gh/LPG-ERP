import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const years = await import("../src/server/services/company/financial-years.ts");

async function fixture() {
  const company = await prisma.company.create({ data: { legalName: doc("FY Company") } });
  const current = await prisma.financialYear.create({ data: { companyId: company.id, label: doc("2026-27"), startsOn: new Date("2026-07-01"), endsOn: new Date("2027-06-30"), isActive: true } });
  const user = await prisma.user.create({ data: { companyId: company.id, financialYearId: current.id, name: doc("FY User"), loginId: doc("fy-user"), passwordHash: "test" } });
  const role = await prisma.role.create({ data: { companyId: company.id, name: doc("FY Role") } });
  for (const action of [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.UPDATE]) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { module_action: { module: "financial-years", action } } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return { company, current, context: { companyId: company.id, financialYearId: current.id, userId: user.id } };
}

test.after(async () => prisma.$disconnect());

test("financial years list and create with overlap protection", async () => {
  const { context, current } = await fixture();
  const created = await years.createFinancialYear(context, { label: "2027-28", startsOn: "2027-07-01", endsOn: "2028-06-30" });
  assert.equal(created.isActive, true);
  assert.equal((await years.listFinancialYears(context)).length, 2);
  assert.rejects(years.createFinancialYear(context, { label: "overlap", startsOn: "2028-01-01", endsOn: "2028-12-31" }), /overlap/i);
  const old = await prisma.financialYear.findUniqueOrThrow({ where: { id: current.id } });
  assert.equal(old.isActive, false);
});

test("financial year opening-balance lock is audited and idempotent", async () => {
  const { context } = await fixture();
  const created = await years.createFinancialYear(context, { label: doc("Lock FY"), startsOn: "2030-07-01", endsOn: "2031-06-30" });
  const locked = await years.lockOpeningBalances(context, created.id);
  assert.ok(locked.openingBalancesLockedAt);
  const again = await years.lockOpeningBalances(context, created.id);
  assert.equal(again.openingBalancesLockedAt?.toISOString(), locked.openingBalancesLockedAt?.toISOString());
  const audit = await prisma.auditLog.findFirst({ where: { companyId: context.companyId, entityType: "FinancialYear", entityId: created.id, action: "UPDATE" }, orderBy: { createdAt: "desc" } });
  assert.equal(audit?.after?.openingBalancesLockedById, context.userId);
});
