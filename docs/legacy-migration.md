# Legacy MySQL migration gate

The reference ERP is a MySQL/CodeIgniter application; LPG-ERP uses Prisma/Postgres. A
reference backup must therefore be inspected and reconciled before historical data is
written into the new database.

## Safe first step

Run the dependency-free inspector against the actual downloaded dump:

```powershell
node scripts/import-legacy-backup.mjs --dump C:\path\to\reference.sql
```

The command is read-only. It prints the detected tables, columns, row counts, mapped
business roles, and unmapped tables. It deliberately does not connect to Postgres and
does not write data. HTML backup-page downloads and encoded/encrypted backup payloads are
rejected explicitly. The recovered `mydb_(09-15-31_2026-07-07).zip` contains a
Base64-wrapped ciphertext payload rather than plain SQL; it requires the reference
application's decryption key before table mapping can begin.

The importer must not be extended to write until the inspector output is reviewed against
the real table names and column meanings. This avoids silently shifting customer balances,
stock quantities, or legacy account codes.

### Verified artifacts

The downloaded files `Db_backup_2`, `Db_backup_3`, and `Db_backup_4` are identical 72,406-byte
HTML renders of the reference backup page (SHA-256:
`b07b020ad3861383b61bed4b76ebea1e598e598743cbe4a6ab54ad5a3b88970e`). Running the inspector
against `Db_backup_4` returns `The supplied file is HTML, not a MySQL dump.` The only database
payload currently identified is `mydb_(09-15-31_2026-07-07).zip`, whose single SQL-named member
is a Base64-wrapped ciphertext payload and still requires the reference decryption key.

## Reconciliation contract

After a reviewed import dry run produces expected and actual metric JSON files, compare
them with:

```powershell
node scripts/verify-legacy-migration.mjs --expected expected.json --actual actual.json
```

The gate covers trial-balance difference, customer-ledger difference, stock difference,
customer-cylinder difference, cash/bank difference, and dashboard KPI difference. The
default tolerance is `0.01`; use `--tolerance` only with a documented currency/rounding
reason.

## Required migration sequence

1. Obtain the real `.sql` dump from the reference Database Backup screen.
2. Run the inspector and review every mapped/unmapped table.
3. Map legacy financial years, chart-account codes, masters, transactions, and document
   sequences to the Prisma schema.
4. Run a write-disabled dry run and capture rejected rows.
5. Import into a disposable database, then produce the reconciliation metrics.
6. Do not cut over until the reconciliation gate passes and the imported database has a
   fresh backup.
