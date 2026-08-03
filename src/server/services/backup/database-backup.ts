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

export type RestoreBackupResult = {
  success: boolean;
  pgRestoreAvailable: boolean;
  message: string;
};
export type BackupSchedule = { enabled: boolean; frequency: "DAILY" | "WEEKLY"; time: string; day: number; retentionDays: number; lastRunAt: string | null; due: boolean };

function ensureBackupDir() {
  if (process.env.VERCEL === "1") return false;
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

function localBackupsAvailable() {
  return ensureBackupDir();
}

export function isPgDumpAvailable(): boolean {
  const result = spawnSync("pg_dump", ["--version"], { encoding: "utf8", timeout: 5000 });
  return result.status === 0;
}

function scheduleDue(schedule: { backupScheduleEnabled: boolean; backupScheduleFrequency: string; backupScheduleTime: string; backupScheduleDay: number; backupLastRunAt: Date | null }, now = new Date()) {
  if (!schedule.backupScheduleEnabled || !/^\d{2}:\d{2}$/.test(schedule.backupScheduleTime)) return false;
  const [hour, minute] = schedule.backupScheduleTime.split(":").map(Number);
  if (hour > 23 || minute > 59 || now.getHours() < hour || (now.getHours() === hour && now.getMinutes() < minute)) return false;
  if (schedule.backupScheduleFrequency === "WEEKLY" && now.getDay() !== schedule.backupScheduleDay) return false;
  if (!schedule.backupLastRunAt) return true;
  const last = new Date(schedule.backupLastRunAt);
  return schedule.backupScheduleFrequency === "WEEKLY"
    ? now.getTime() - last.getTime() >= 6 * 24 * 60 * 60 * 1000
    : now.toDateString() !== last.toDateString();
}

export function isPgRestoreAvailable(): boolean {
  const result = spawnSync("pg_restore", ["--version"], { encoding: "utf8", timeout: 5000 });
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

export async function triggerBackup(context: Context, backupDate?: string): Promise<TriggerBackupResult> {
  await checkPermission(context.userId);

  if (backupDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(backupDate)) {
    return { success: false, pgDumpAvailable: false, message: "Invalid backup date. Expected YYYY-MM-DD." };
  }

  if (!localBackupsAvailable()) {
    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        companyId: context.companyId,
        userId: context.userId,
        action: AuditAction.CREATE,
        entityType: "DatabaseBackup",
        entityId: `backup-attempt-${Date.now()}`,
        after: { status: "skipped", reason: "local backup directory unavailable" },
      });
    });
    return {
      success: false,
      pgDumpAvailable: false,
      message: "Local database backups are not available in this hosting environment. Use your database provider's backup tools instead.",
    };
  }

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
  const filename = backupDate ? `backup-${backupDate}-${timestamp}.dump` : `backup-${timestamp}.dump`;
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
      after: { filename, backupDate: backupDate ?? null, status: succeeded ? "success" : "failed", exitCode: result.status },
    });
  });

  if (!succeeded) {
    return { success: false, pgDumpAvailable: true, message: `pg_dump exited with code ${result.status ?? "unknown"}.` };
  }

  return { success: true, pgDumpAvailable: true, filename, message: `Backup created: ${filename}` };
}

export function listBackupFiles(): BackupFile[] {
  if (!localBackupsAvailable()) return [];
  try {
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => /^backup-[\w.-]+\.(dump|sql|gz)$/.test(f));
    return files
      .map((filename) => {
        const stat = fs.statSync(path.join(BACKUP_DIR, filename));
        return { filename, size: stat.size, createdAt: stat.birthtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
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

export async function getBackupSchedule(context: Context): Promise<BackupSchedule> {
  await checkPermission(context.userId);
  const company = await prisma.company.findUniqueOrThrow({ where: { id: context.companyId }, select: { backupScheduleEnabled: true, backupScheduleFrequency: true, backupScheduleTime: true, backupScheduleDay: true, backupRetentionDays: true, backupLastRunAt: true } });
  return { enabled: company.backupScheduleEnabled, frequency: company.backupScheduleFrequency === "WEEKLY" ? "WEEKLY" : "DAILY", time: company.backupScheduleTime, day: company.backupScheduleDay, retentionDays: company.backupRetentionDays, lastRunAt: company.backupLastRunAt?.toISOString() ?? null, due: scheduleDue(company) };
}

export async function updateBackupSchedule(context: Context, input: { enabled?: boolean; frequency?: string; time?: string; day?: number; retentionDays?: number }) {
  await checkPermission(context.userId);
  const frequency = input.frequency === "WEEKLY" ? "WEEKLY" : input.frequency === "DAILY" ? "DAILY" : undefined;
  if (!frequency) throw new Error("frequency must be DAILY or WEEKLY.");
  if (!input.time || !/^\d{2}:\d{2}$/.test(input.time) || Number(input.time.slice(0, 2)) > 23 || Number(input.time.slice(3)) > 59) throw new Error("time must use HH:MM.");
  const day = input.day ?? 0;
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new Error("day must be between 0 and 6.");
  const retentionDays = input.retentionDays ?? 30;
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error("retentionDays must be between 1 and 3650.");
  await prisma.$transaction(async (tx) => {
    const before = await tx.company.findUniqueOrThrow({ where: { id: context.companyId }, select: { backupScheduleEnabled: true, backupScheduleFrequency: true, backupScheduleTime: true, backupScheduleDay: true, backupRetentionDays: true } });
    const company = await tx.company.update({ where: { id: context.companyId }, data: { backupScheduleEnabled: input.enabled ?? false, backupScheduleFrequency: frequency, backupScheduleTime: input.time, backupScheduleDay: day, backupRetentionDays: retentionDays } });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "CompanyBackupSchedule", entityId: context.companyId, before, after: { enabled: company.backupScheduleEnabled, frequency, time: company.backupScheduleTime, day, retentionDays } });
  });
  return getBackupSchedule(context);
}

function applyRetention(retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const file of listBackupFiles()) {
    if (new Date(file.createdAt).getTime() < cutoff) {
      const filepath = resolveBackupFilePath(file.filename);
      if (filepath) fs.unlinkSync(filepath);
    }
  }
}

export async function runDueBackup(context: Context, now = new Date()) {
  await checkPermission(context.userId);
  const company = await prisma.company.findUniqueOrThrow({ where: { id: context.companyId }, select: { backupScheduleEnabled: true, backupScheduleFrequency: true, backupScheduleTime: true, backupScheduleDay: true, backupRetentionDays: true, backupLastRunAt: true } });
  if (!scheduleDue(company, now)) return { due: false, result: null };
  const result = await triggerBackup(context, now.toISOString().slice(0, 10));
  if (result.success) {
    applyRetention(company.backupRetentionDays);
    await prisma.company.update({ where: { id: context.companyId }, data: { backupLastRunAt: now } });
  }
  return { due: true, result };
}

export async function restoreBackup(context: Context, filename: string, confirmation: string): Promise<RestoreBackupResult> {
  await checkPermission(context.userId);
  const filepath = resolveBackupFilePath(filename);
  if (!filepath) throw new Error("Backup file not found.");
  if (confirmation !== filename) throw new Error("Type the exact backup filename to confirm restore.");
  if (!isPgRestoreAvailable()) return { success: false, pgRestoreAvailable: false, message: "pg_restore is not available on this system." };

  const dbUrl = process.env.DATABASE_URL ?? "";
  const db = parseDbUrl(dbUrl);
  const result = spawnSync(
    "pg_restore",
    ["-h", db.host, "-p", db.port, "-U", db.user, "-d", db.dbname, "--clean", "--if-exists", "--no-owner", "--no-privileges", filepath],
    { encoding: "utf8", timeout: 300000, env: { ...process.env, PGPASSWORD: db.password } },
  );
  const succeeded = result.status === 0;
  await prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "DatabaseBackup",
      entityId: filename,
      after: { filename, status: succeeded ? "restored" : "restore_failed", exitCode: result.status },
    });
  });
  return { success: succeeded, pgRestoreAvailable: true, message: succeeded ? `Backup restored: ${filename}` : `pg_restore exited with code ${result.status ?? "unknown"}.` };
}
