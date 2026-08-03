# Scheduled Backups

The Database Backup screen stores a daily or weekly schedule and retention window. The application exposes `POST /api/database-backup/run-due`; it checks whether the configured schedule is due, creates a backup through `pg_dump`, removes backups older than the retention window, and records the last successful run.

Because Next.js does not guarantee a resident background process, configure an external scheduler on the deployment host. The repository includes `scripts/run-scheduled-backup.mjs`.

Required environment variables:

- `BACKUP_RUN_DUE_URL`: the absolute URL for `/api/database-backup/run-due`
- `BACKUP_SESSION_COOKIE`: a session cookie belonging to a user with Database Backup/RBAC management permission

Run the script at least hourly; the persisted schedule determines whether a backup is actually due. Keep the session cookie protected like a password and rotate it if access changes.
