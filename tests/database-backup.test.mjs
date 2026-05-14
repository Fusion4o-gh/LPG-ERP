import assert from "node:assert/strict";
import test from "node:test";
import { AuditAction, PermissionAction, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const backup = await import("../src/server/services/backup/database-backup.ts");
const sessions = await import("../src/server/auth/session.ts");
const backupRoute = await import("../src/app/api/database-backup/route.ts");

function doc(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const auditEntityIds = new Set();

async function fixture() {
  const suffix = doc("db").toLowerCase();
  const company = await prisma.company.create({
    data: { legalName: `DB Backup Test ${suffix}`, stockAvailableCheck: false },
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
  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `DB Admin ${suffix}`,
      loginId: `db-admin-${suffix}`,
      passwordHash: "test",
    },
  });
  const adminRole = await prisma.role.create({
    data: { companyId: company.id, name: `Admin ${suffix}` },
  });
  const rbacPermission = await prisma.permission.upsert({
    where: { module_action: { module: "rbac", action: PermissionAction.MANAGE_RBAC } },
    update: {},
    create: { module: "rbac", action: PermissionAction.MANAGE_RBAC },
  });
  await prisma.rolePermission.create({ data: { roleId: adminRole.id, permissionId: rbacPermission.id } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });

  const noPermUser = await prisma.user.create({
    data: {
      companyId: company.id,
      financialYearId: financialYear.id,
      name: `DB NoPerms ${suffix}`,
      loginId: `db-noperm-${suffix}`,
      passwordHash: "test",
    },
  });

  const context = { companyId: company.id, financialYearId: financialYear.id, userId: admin.id };
  return { company, financialYear, admin, noPermUser, context };
}

async function authedGet(user, url) {
  const session = await sessions.createSession(user.id);
  return new Request(url, { headers: { cookie: `lpg_erp_session=${session.sessionToken}` } });
}

test.after(async () => {
  if (auditEntityIds.size) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...auditEntityIds] } } });
  }
  await prisma.$disconnect();
});

// ── Authorization ─────────────────────────────────────────────────────────────

test("unauthorized user denied for backup trigger", async () => {
  const { company, financialYear, noPermUser } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };
  await assert.rejects(
    () => backup.triggerBackup(context),
    /permission|forbidden|unauthorized/i,
  );
});

test("unauthorized user denied for backup list", async () => {
  const { company, financialYear, noPermUser } = await fixture();
  const context = { companyId: company.id, financialYearId: financialYear.id, userId: noPermUser.id };
  await assert.rejects(
    () => backup.listBackups(context),
    /permission|forbidden|unauthorized/i,
  );
});

// ── Endpoint Validation ───────────────────────────────────────────────────────

test("backup list endpoint returns error without authentication", async () => {
  const req = new Request("http://localhost/api/database-backup");
  const res = await backupRoute.GET(req);
  assert.ok(res.status >= 400, `expected error status, got ${res.status}`);
});

test("backup trigger endpoint returns error without authentication", async () => {
  const req = new Request("http://localhost/api/database-backup", { method: "POST" });
  const res = await backupRoute.POST(req);
  assert.ok(res.status >= 400, `expected error status, got ${res.status}`);
});

// ── Backup List ───────────────────────────────────────────────────────────────

test("backup list returns array for authorized user", async () => {
  const { context } = await fixture();
  const result = await backup.listBackups(context);
  assert.ok(Array.isArray(result), "should return an array");
});

test("backup list endpoint works via HTTP", async () => {
  const { admin } = await fixture();
  const req = await authedGet(admin, "http://localhost/api/database-backup");
  const res = await backupRoute.GET(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.backups));
});

// ── pg_dump Graceful Fallback ─────────────────────────────────────────────────

test("graceful handling when pg_dump unavailable", async () => {
  const { context } = await fixture();
  // In this test environment pg_dump is not installed — service must not throw
  const result = await backup.triggerBackup(context);
  if (!backup.isPgDumpAvailable()) {
    assert.equal(result.pgDumpAvailable, false);
    assert.equal(result.success, false);
    assert.ok(result.message.length > 0, "should have descriptive message");
  } else {
    // pg_dump is available — either succeeds or fails cleanly
    assert.equal(typeof result.success, "boolean");
    assert.ok(result.message.length > 0);
  }
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

test("backup action audit log written", async () => {
  const { company, context } = await fixture();
  const before = new Date();

  await backup.triggerBackup(context);

  const log = await prisma.auditLog.findFirst({
    where: {
      companyId: company.id,
      userId: context.userId,
      entityType: "DatabaseBackup",
      action: AuditAction.CREATE,
      createdAt: { gte: before },
    },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(log, "should have written a DatabaseBackup audit log");
  assert.equal(log.action, AuditAction.CREATE);
  if (log.entityId) auditEntityIds.add(log.entityId);
});

// ── Path Traversal Safety ─────────────────────────────────────────────────────

test("resolveBackupFilePath rejects path traversal attempts", () => {
  assert.equal(backup.resolveBackupFilePath("../etc/passwd"), null);
  assert.equal(backup.resolveBackupFilePath("../../.env"), null);
  assert.equal(backup.resolveBackupFilePath("backup-valid.dump"), null); // doesn't exist, returns null
  assert.equal(backup.resolveBackupFilePath("backup-valid.exe"), null);  // wrong extension
});
