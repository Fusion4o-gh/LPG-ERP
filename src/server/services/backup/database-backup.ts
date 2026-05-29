import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { AuditAction, PermissionAction } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { enforcePermission } from "../rbac/enforce.ts";
import { writeAuditLog } from "../audit/audit-log.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

const BACKUP_DIR = path.join(process.cwd(), "backups");

export type BackupFile = {
  filename: string;
  size: number;
  createdAt: string;
};

export type TriggerBackupResult = {
  success: boolean;
  pgDumpAvailable: boolean;
  filename?: string;
  message: string;
};

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function isPgDumpAvailable(): boolean {
  const result = spawnSync("pg_dump", ["--version"], { encoding: "utf8", timeout: 5000 });
  return result.status === 0;
}

function parseDbUrl(url: string) {
  const match = url.match(/^postgresql?:\/\/([^:]+):([^@]*)@([^:/]+):(\d+)\/([^?]+)/);
  if (!match) throw new Error("Cannot parse DATABASE_URL for backup.");
  return { user: match[1], password: match[2], host: match[3], port: match[4], dbname: match[5] };
}

async function checkPermission(userId: string) {
  await prisma.$transaction(async (tx) => {
    await enforcePermission(tx, userId, "rbac", PermissionAction.MANAGE_RBAC);
  });
}

export async function triggerBackup(context: Context): Promise<TriggerBackupResult> {
  await checkPermission(context.userId);

  ensureBackupDir();

  const pgAvailable = isPgDumpAvailable();

  if (!pgAvailable) {
    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        companyId: context.companyId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entityType: "DatabaseBackup",
        entityId: `backup-attempt-${Date.now()}`,
        after: { status: "skipped", reason: "pg_dump not available" },
      });
    });
    return {
      success: false,
      pgDumpAvailable: false,
      message: "pg_dump is not available on this system. Install PostgreSQL client tools to enable database backups.",
    };
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  const db = parseDbUrl(dbUrl);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
  const filename = `backup-${timestamp}.dump`;
  const filepath = path.join(BACKUP_DIR, filename);

  const result = spawnSync(
    "pg_dump",
    ["-h", db.host, "-p", db.port, "-U", db.user, "-d", db.dbname, "-Fc", "-f", filepath],
    { encoding: "utf8", timeout: 120000, env: { ...process.env, PGPASSWORD: db.password } },
  );

  const succeeded = result.status === 0;

  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.CREATE,
      entityType: "DatabaseBackup",
      entityId: filename,
      after: { filename, status: succeeded ? "success" : "failed", exitCode: result.status },
    });
  });

  if (!succeeded) {
    return { success: false, pgDumpAvailable: true, message: `pg_dump exited with code ${result.status ?? "unknown"}.` };
  }

  return { success: true, pgDumpAvailable: true, filename, message: `Backup created: ${filename}` };
}

export function listBackupFiles(): BackupFile[] {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^backup-[\w.-]+\.(dump|sql|gz)$/.test(f));
  return files
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return { filename, size: stat.size, createdAt: stat.birthtime.toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listBackups(context: Context): Promise<BackupFile[]> {
  await checkPermission(context.userId);
  return listBackupFiles();
}

export function resolveBackupFilePath(filename: string): string | null {
  if (!/^backup-[\w.-]+\.(dump|sql|gz)$/.test(filename)) return null;
  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) return null;
  return filepath;
}

export async function getBackupDownloadPath(context: Context, filename: string): Promise<string> {
  await checkPermission(context.userId);
  const filepath = resolveBackupFilePath(filename);
  if (!filepath) throw new Error("Backup file not found.");
  return filepath;
}
