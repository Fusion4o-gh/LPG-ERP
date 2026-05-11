import assert from "node:assert/strict";
import test from "node:test";
import { PermissionAction, PrismaClient } from "@prisma/client";
import { doc } from "./helpers/lpg-fixtures.mjs";

const prisma = new PrismaClient();
const sessions = await import("../src/server/auth/session.ts");
const companyInfo = await import("../src/server/services/company/company-information.ts");
const companyInfoRoute = await import("../src/app/api/configuration/company-information/route.ts");

async function grant(userId, companyId, actions) {
  const role = await prisma.role.create({ data: { companyId, name: doc("Company Info Role") } });
  for (const action of actions) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { module_action: { module: "company", action } } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
  }
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
  return role;
}

async function fixture(actions = [PermissionAction.VIEW, PermissionAction.UPDATE]) {
  const suffix = doc("company-info").toLowerCase();
  const company = await prisma.company.create({
    data: {
      legalName: `Company Info ${suffix}`,
      tradeName: `Trade ${suffix}`,
      ownerName: "Owner",
      address: "Initial address",
      phone: "042-0000000",
      email: "initial@example.com",
      taxRegistrationNumber: "GST-INITIAL",
      nationalTaxNumber: "NTN-INITIAL",
      workingDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
    },
  });
  const financialYear = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      label: suffix,
      startsOn: new Date("2026-01-01"),
      endsOn: new Date("2026-12-31"),
      isActive: true,
    },
  });
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `Company Info User ${suffix}`,
      loginId: `company-info-${suffix}`,
      passwordHash: "test",
    },
  });
  await grant(user.id, company.id, actions);
  return {
    company,
    financialYear,
    user,
    context: { companyId: company.id, financialYearId: financialYear.id, userId: user.id },
  };
}

async function authedRequest(user, method = "GET", body) {
  const session = await sessions.createSession(user.id);
  return new Request("http://localhost/api/configuration/company-information", {
    method,
    headers: { "content-type": "application/json", cookie: `lpg_erp_session=${session.sessionToken}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.after(async () => {
  await prisma.$disconnect();
});

test("company info loads", async () => {
  const { user } = await fixture();
  const response = await companyInfoRoute.GET(await authedRequest(user));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.match(body.company.legalName, /^Company Info/);
  assert.equal(body.company.taxRegistrationNumber, "GST-INITIAL");
});

test("company info edit works and writes audit log", async () => {
  const { company, context } = await fixture();
  const updated = await companyInfo.updateCompanyInformation(context, {
    legalName: "Updated LPG Company",
    tradeName: "Updated Trade",
    ownerName: "Updated Owner",
    address: "Updated address",
    phone: "0300-0000000",
    email: "updated@example.com",
    taxRegistrationNumber: "GST-UPDATED",
    nationalTaxNumber: "NTN-UPDATED",
    workingDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: false },
  });

  assert.equal(updated.legalName, "Updated LPG Company");
  assert.equal(updated.email, "updated@example.com");
  assert.equal(updated.taxRegistrationNumber, "GST-UPDATED");
  assert.equal(updated.workingDays.saturday, true);

  const audit = await prisma.auditLog.findFirst({
    where: { companyId: company.id, entityType: "Company", entityId: company.id, action: "UPDATE" },
  });
  assert.ok(audit);
});

test("invalid email rejected", async () => {
  const { context } = await fixture();

  await assert.rejects(
    companyInfo.updateCompanyInformation(context, {
      legalName: "Invalid Email Company",
      email: "not-an-email",
    }),
    /email must be valid/i,
  );
});

test("unauthorized user denied", async () => {
  const { company, financialYear } = await fixture();
  const deniedUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: doc("Denied Company Info"),
      loginId: doc("denied-company-info"),
      passwordHash: "test",
    },
  });
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: deniedUser.id };

  await assert.rejects(companyInfo.getCompanyInformation(context), /permission/i);
  await assert.rejects(companyInfo.updateCompanyInformation(context, { legalName: "Denied" }), /permission/i);
});
