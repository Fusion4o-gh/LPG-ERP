import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const dashboard = await import("../src/server/services/dashboard/dashboard.ts");

async function fixture() {
  const suffix = doc("dash").toLowerCase();
  const company = await prisma.company.create({ data: { legalName: `Dash Test ${suffix}`, stockAvailableCheck: false } });
  const financialYear = await prisma.financialYear.create({
    data: { companyId: company.id, label: suffix, startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31"), isActive: true },
  });
  const admin = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: `Dash Admin ${suffix}`, loginId: `dash-admin-${suffix}`, passwordHash: "test" },
  });
  const adminRole = await prisma.role.create({ data: { companyId: company.id, name: `Admin ${suffix}` } });
  const reportsPermission = await prisma.permission.upsert({
    where: { module_action: { module: "reports", action: PermissionAction.VIEW } },
    update: {},
    create: { module: "reports", action: PermissionAction.VIEW },
  });
  await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: reportsPermission.id } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: admin.id };
  return { company, financialYear, admin, context };
}

test.after(async () => {
  await prisma.$disconnect();
});

test("getDashboardData returns all expected KPI keys", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(typeof data.kpis.todayCash === "number");
  assert.ok(typeof data.kpis.cashPosition === "number");
  assert.ok(typeof data.kpis.receivables === "number");
  assert.ok(typeof data.kpis.payables === "number");
  assert.ok(typeof data.kpis.todaySale === "number");
  assert.ok(typeof data.kpis.expenses === "number");
  assert.ok(typeof data.kpis.mExpenses === "number");
  assert.ok(typeof data.backup.isStale === "boolean");
});

test("getDashboardData returns bank position array", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(Array.isArray(data.bankPosition));
  if (data.bankPosition.length > 0) {
    const bank = data.bankPosition[0];
    assert.ok("id" in bank);
    assert.ok("name" in bank);
    assert.ok("balance" in bank);
    assert.ok(typeof bank.balance === "number");
  }
});

test("getDashboardData returns current stock array", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(Array.isArray(data.currentStock));
  if (data.currentStock.length > 0) {
    const row = data.currentStock[0];
    assert.ok("itemCode" in row);
    assert.ok("filled" in row);
    assert.ok("empty" in row);
  }
});

test("getDashboardData returns sale stats with today and month", async () => {
  const { context } = await fixture();
  const data = await dashboard.getDashboardData(context);

  assert.ok(typeof data.saleStats.today.count === "number");
  assert.ok(typeof data.saleStats.today.amount === "number");
  assert.ok(typeof data.saleStats.month.count === "number");
  assert.ok(typeof data.saleStats.month.amount === "number");
});

test("unauthorized user denied for dashboard", async () => {
  const { company, financialYear } = await fixture();
  const noPermUser = await prisma.user.create({
    data: { companyId: company.id, financialYearId: financialYear.id, name: "No Perm Dash", loginId: doc("noperm-dash"), passwordHash: "test" },
  });
  const noPermContext = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };

  await assert.rejects(dashboard.getDashboardData(noPermContext), /permission/i);
});

test("dashboard client exposes all quick link labels", async () => {
  const root = new URL("../", import.meta.url);
  const client = await readFile(new URL("src/app/(protected)/dashboard/DashboardClient.tsx", root), "utf8");

  assert.match(client, /Single Sale/);
  assert.match(client, /Complete Day Sale/);
  assert.match(client, /Purchase/);
  assert.match(client, /Payment/);
  assert.match(client, /Receipt/);
  assert.match(client, /Cylinder Return/);
  assert.match(client, /Customer Ledger/);
  assert.match(client, /Stock Report/);
  assert.match(client, /Daily Activity/);
  assert.match(client, /Customer Stock Ledger/);
  assert.match(client, /Cash Book/);
  assert.match(client, /Profit\/Loss Report/);
});
