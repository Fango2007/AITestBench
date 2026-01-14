import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'harness.sqlite');

let dbInstance: Database.Database | null = null;

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.AITESTBENCH_DB_PATH || DEFAULT_DB_PATH;
  ensureDir(dbPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  dbInstance = db;
  return dbInstance;
}

export function runSchema(sql: string): void {
  const db = getDb();
  db.exec(sql);
  ensureTargetsColumns(db);
  ensureActiveTestsSchema(db);
}

function ensureTargetsColumns(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(targets)').all() as Array<{ name: string }>;
  if (columns.length === 0) {
    return;
  }
  const existing = new Set(columns.map((column) => column.name));
  const additions = [
    { name: 'auth_type', sql: 'ALTER TABLE targets ADD COLUMN auth_type TEXT' },
    {
      name: 'provider',
      sql: "ALTER TABLE targets ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'"
    },
    { name: 'auth_token_ref', sql: 'ALTER TABLE targets ADD COLUMN auth_token_ref TEXT' },
    { name: 'default_model', sql: 'ALTER TABLE targets ADD COLUMN default_model TEXT' },
    { name: 'default_params', sql: 'ALTER TABLE targets ADD COLUMN default_params TEXT' },
    { name: 'timeouts', sql: 'ALTER TABLE targets ADD COLUMN timeouts TEXT' },
    { name: 'concurrency_limit', sql: 'ALTER TABLE targets ADD COLUMN concurrency_limit INTEGER' },
    {
      name: 'status',
      sql: "ALTER TABLE targets ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"
    },
    {
      name: 'connectivity_status',
      sql: "ALTER TABLE targets ADD COLUMN connectivity_status TEXT NOT NULL DEFAULT 'pending'"
    },
    { name: 'last_check_at', sql: 'ALTER TABLE targets ADD COLUMN last_check_at TEXT' },
    { name: 'last_error', sql: 'ALTER TABLE targets ADD COLUMN last_error TEXT' },
    { name: 'models', sql: 'ALTER TABLE targets ADD COLUMN models TEXT' }
  ];

  for (const addition of additions) {
    if (!existing.has(addition.name)) {
      db.exec(addition.sql);
    }
  }

  db.exec("UPDATE targets SET provider = 'openai' WHERE provider IS NULL");
  db.exec("UPDATE targets SET status = 'active' WHERE status IS NULL");
  db.exec("UPDATE targets SET connectivity_status = 'pending' WHERE connectivity_status IS NULL");
}

function ensureActiveTestsSchema(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS active_tests (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      template_version TEXT NOT NULL,
      target_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      version TEXT NOT NULL,
      command_preview TEXT,
      python_ready INTEGER NOT NULL DEFAULT 0
    )`
  );

  const columns = db.prepare('PRAGMA table_info(active_tests)').all() as Array<{ name: string }>;
  if (columns.length === 0) {
    return;
  }
  const existing = new Set(columns.map((column) => column.name));
  const additions = [
    { name: 'template_version', sql: 'ALTER TABLE active_tests ADD COLUMN template_version TEXT' },
    { name: 'target_id', sql: 'ALTER TABLE active_tests ADD COLUMN target_id TEXT' },
    { name: 'model_name', sql: 'ALTER TABLE active_tests ADD COLUMN model_name TEXT' },
    { name: 'status', sql: "ALTER TABLE active_tests ADD COLUMN status TEXT NOT NULL DEFAULT 'ready'" },
    { name: 'created_at', sql: 'ALTER TABLE active_tests ADD COLUMN created_at TEXT' },
    { name: 'deleted_at', sql: 'ALTER TABLE active_tests ADD COLUMN deleted_at TEXT' },
    { name: 'version', sql: 'ALTER TABLE active_tests ADD COLUMN version TEXT' },
    { name: 'command_preview', sql: 'ALTER TABLE active_tests ADD COLUMN command_preview TEXT' },
    {
      name: 'python_ready',
      sql: 'ALTER TABLE active_tests ADD COLUMN python_ready INTEGER NOT NULL DEFAULT 0'
    }
  ];

  for (const addition of additions) {
    if (!existing.has(addition.name)) {
      db.exec(addition.sql);
    }
  }
}
