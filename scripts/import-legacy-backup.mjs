import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TABLE_ROLE_ALIASES = new Map([
  ["company", ["company", "companies", "tbl_company"]],
  ["financialYear", ["financial_year", "financial_years", "financialyear", "financialyears"]],
  ["user", ["user", "users", "tbl_user"]],
  ["city", ["city", "cities", "tbl_city"]],
  ["area", ["area", "areas", "tbl_area"]],
  ["brand", ["brand", "brands", "tbl_brand"]],
  ["category", ["category", "categories", "tbl_category"]],
  ["item", ["item", "items", "tbl_item"]],
  ["customer", ["customer", "customers", "tbl_customer"]],
  ["vendor", ["vendor", "vendors", "tbl_vendor"]],
  ["bank", ["bank", "banks", "tbl_bank"]],
  ["chartAccount", ["chart_of_account", "chart_of_accounts", "chartofaccount", "chartofaccounts", "coa"]],
  ["sale", ["sale", "sales", "sale_lpg", "salelpg"]],
  ["purchase", ["purchase", "purchases", "direct_girn", "directgirn", "girn"]],
  ["cylinderReturn", ["sale_return", "sale_returns", "salereturn", "salereturns"]],
  ["cashPayment", ["cash_payment", "cash_payments", "multiplecashpayment"]],
  ["cashReceipt", ["cash_receipt", "cash_receipts", "multiplecashreceipt"]],
  ["bankTransaction", ["bank_payment", "bank_payments", "bank_receipt", "bank_receipts", "account_bank_payment"]],
  ["journalVoucher", ["journal_voucher", "journal_vouchers", "journalvoucher"]],
]);

function normalizeTableName(value) {
  return String(value ?? "")
    .replaceAll("`", "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replace(/^tbl_/, "tbl_");
}

function readSqlStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        if (sql[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === ";") {
      const statement = sql.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

function splitTopLevel(value, separator = ",") {
  const parts = [];
  let start = 0;
  let quote = null;
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) {
        if (value[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === separator && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function findMatchingParen(value, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) {
        if (value[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function decodeMysqlValue(raw) {
  const value = raw.trim();
  if (/^null$/i.test(value)) return null;
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    const quote = value[0];
    const body = value.slice(1, -1);
    return body
      .replaceAll(`\\${quote}`, quote)
      .replaceAll("\\0", "\0")
      .replaceAll("\\n", "\n")
      .replaceAll("\\r", "\r")
      .replaceAll("\\t", "\t")
      .replaceAll("\\\\", "\\")
      .replaceAll(quote + quote, quote);
  }
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
  return value;
}

function parseInsert(statement) {
  const match = statement.match(/^\s*INSERT\s+INTO\s+(`[^`]+`|[a-z0-9_$]+)\s*(?:\(([^)]*)\))?\s*VALUES\s*/i);
  if (!match) return null;
  const table = normalizeTableName(match[1]);
  const columns = match[2] ? splitTopLevel(match[2]).map((column) => column.replaceAll("`", "").trim()) : [];
  const valuesStart = match[0].length;
  const rows = [];
  let index = valuesStart;
  while (index < statement.length) {
    while (/\s|,|;/.test(statement[index] ?? "")) index += 1;
    if (statement[index] !== "(") break;
    const end = findMatchingParen(statement, index);
    if (end < 0) throw new Error(`Unclosed INSERT tuple for table ${table}.`);
    rows.push(splitTopLevel(statement.slice(index + 1, end)).map(decodeMysqlValue));
    index = end + 1;
  }
  return { table, columns, rows };
}

function parseCreateTable(statement) {
  const match = statement.match(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(`[^`]+`|[a-z0-9_$]+)\s*\(/i);
  if (!match) return null;
  const open = statement.indexOf("(", match.index + match[0].length - 1);
  const end = findMatchingParen(statement, open);
  if (end < 0) throw new Error(`Unclosed CREATE TABLE statement for ${match[1]}.`);
  const definitions = splitTopLevel(statement.slice(open + 1, end));
  const columns = definitions
    .filter((definition) => !/^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|CHECK)\b/i.test(definition.trim()))
    .map((definition) => definition.match(/^\s*`([^`]+)`|^\s*([a-z0-9_$]+)/i))
    .filter(Boolean)
    .map((match) => match[1] ?? match[2]);
  return { table: normalizeTableName(match[1]), columns };
}

export function parseMysqlDump(sql) {
  if (sql.startsWith("PK\u0003\u0004")) {
    throw new Error("The supplied file is a ZIP archive. Extract the SQL dump before inspection.");
  }
  if (/^\s*<!doctype\s+html/i.test(sql) || /<html[\s>]/i.test(sql.slice(0, 1000))) {
    throw new Error("The supplied file is HTML, not a MySQL dump.");
  }
  const compact = sql.trim();
  if (compact.length > 1000 && /^[A-Za-z0-9+/=\r\n]+$/.test(compact)) {
    const decoded = Buffer.from(compact, "base64").toString("utf8");
    if (!/(?:CREATE\s+TABLE|INSERT\s+INTO|--\s+MySQL)/i.test(decoded.slice(0, 10000))) {
      throw new Error("The supplied file is an encoded or encrypted backup, not plain MySQL SQL. Decrypt it with the reference application's key before inspection.");
    }
  }
  const tables = new Map();
  for (const statement of readSqlStatements(sql)) {
    const created = parseCreateTable(statement);
    if (created) {
      const current = tables.get(created.table) ?? { table: created.table, columns: [], rows: [], insertCount: 0 };
      current.columns = created.columns;
      tables.set(created.table, current);
      continue;
    }
    const insert = parseInsert(statement);
    if (!insert) continue;
    const current = tables.get(insert.table) ?? { table: insert.table, columns: [], rows: [], insertCount: 0 };
    if (insert.columns.length > 0) current.columns = insert.columns;
    current.rows.push(...insert.rows);
    current.insertCount += 1;
    tables.set(insert.table, current);
  }
  if (tables.size === 0 && sql.trim().length > 0) {
    throw new Error("The supplied file does not contain recognizable MySQL CREATE TABLE or INSERT statements.");
  }
  return tables;
}

export function mapLegacyTableRoles(tables) {
  const roles = {};
  for (const table of tables.keys()) {
    const normalized = normalizeTableName(table);
    for (const [role, aliases] of TABLE_ROLE_ALIASES.entries()) {
      if (aliases.includes(normalized) || aliases.includes(normalized.replace(/^tbl_/, ""))) {
        roles[role] ??= [];
        roles[role].push(table);
      }
    }
  }
  return roles;
}

export function inspectDump(sql) {
  const tables = parseMysqlDump(sql);
  const roles = mapLegacyTableRoles(tables);
  return {
    tableCount: tables.size,
    tables: [...tables.values()].map((table) => ({ table: table.table, columns: table.columns, rows: table.rows.length, insertStatements: table.insertCount })),
    mappedRoles: roles,
    unmappedTables: [...tables.keys()].filter((table) => !Object.values(roles).flat().includes(table)),
    writeEnabled: false,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    args[key] = argv[index + 1]?.startsWith("--") ? true : argv[++index];
  }
  return args;
}

if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = parseArgs(process.argv.slice(2));
  const filename = args.dump;
  if (!filename) {
    console.error("Usage: node scripts/import-legacy-backup.mjs --dump <path-to-mysql.sql>");
    process.exit(2);
  }
  const path = resolve(filename);
  if (!existsSync(path)) {
    console.error(`Dump file not found: ${path}`);
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(inspectDump(readFileSync(path, "utf8")), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
