import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'aitestbench.sqlite');

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
}
