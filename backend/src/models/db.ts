import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..', '..');
const DEFAULT_DB_PATH = path.join(repoRoot, 'backend', 'data', 'db', 'aitestbench.sqlite');

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

  const configuredPath = process.env.AITESTBENCH_DB_PATH?.trim();
  const dbPath = configuredPath
    ? (path.isAbsolute(configuredPath) ? configuredPath : path.resolve(repoRoot, configuredPath))
    : DEFAULT_DB_PATH;
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
}

export function resetDbInstance(): void {
  if (!dbInstance) {
    return;
  }
  dbInstance.close();
  dbInstance = null;
}
