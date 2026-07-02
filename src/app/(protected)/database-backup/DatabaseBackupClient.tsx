"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "@/components/ApiError";
import { PageHeader } from "@/components/PageHeader";

type BackupFile = {
  filename: string;
  size: number;
  createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function DatabaseBackupClient() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusOk, setStatusOk] = useState(false);
  const [backupDate, setBackupDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ backups: BackupFile[] }>("/api/database-backup");
      setBackups(data.backups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerBackup() {
    setTriggering(true);
    setError("");
    setStatusMessage("");
    try {
      const data = await apiPost<{ result: { success: boolean; pgDumpAvailable: boolean; filename?: string; message: string } }>(
        "/api/database-backup",
        { backupDate },
      );
      setStatusOk(data.result.success);
      setStatusMessage(data.result.message);
      if (data.result.success) await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup trigger failed.");
    } finally {
      setTriggering(false);
    }
  }

  const lastBackup = backups[0];

  return (
    <div>
      <PageHeader
        title="Database Backup"
        description="Create and download local database backups. Requires pg_dump on the server."
      />

      {/* Status cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Backup</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {lastBackup ? formatDate(lastBackup.createdAt) : "No backups yet"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Backups</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{backups.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Storage Used</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {formatBytes(backups.reduce((sum, b) => sum + b.size, 0))}
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900">Manual Backup</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Triggers a pg_dump backup to the local backups directory. Requires PostgreSQL client tools installed on the server.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              type="date"
              value={backupDate}
              onChange={(e) => setBackupDate(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              aria-label="Backup date"
            />
            <button
              onClick={triggerBackup}
              disabled={triggering}
              className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--flame-gradient)" }}
            >
              {triggering ? "Running…" : "Trigger Backup"}
            </button>
          </div>
        </div>

        {statusMessage && (
          <p className={`mt-3 rounded p-2 text-sm ${statusOk ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
            {statusMessage}
          </p>
        )}
      </div>

      <ApiError message={error} />

      {/* File list */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Backup Files</h2>
        </div>

        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        ) : backups.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No backup files found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Filename</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Size</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((file) => (
                <tr key={file.filename} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{file.filename}</td>
                  <td className="px-4 py-3 text-slate-600">{formatBytes(file.size)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(file.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/api/database-backup/download/${file.filename}`}
                      className="rounded px-3 py-1 text-xs font-medium text-white"
                      style={{ background: "var(--flame-gradient)" }}
                      download
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
