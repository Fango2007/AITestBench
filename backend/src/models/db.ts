import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..', '..');
const DEFAULT_DB_PATH = path.join(repoRoot, 'backend', 'data', 'db', 'aitestbench.sqlite');
const DEFAULT_BACKEND_TEST_DB_PATH = path.join(repoRoot, 'backend', 'data', 'db', 'backend-test.sqlite');

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

  const dbPath = resolvedDbPath();
  const isSpecialPath = dbPath === ':memory:' || dbPath.startsWith('file:');
  if (!isSpecialPath) {
    ensureDir(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  dbInstance = db;
  return dbInstance;
}

export function resolvedDbPath(): string {
  const configuredPath = process.env.AITESTBENCH_DB_PATH?.trim();
  const isBackendTest = isBackendTestRun();
  if (configuredPath) {
    const dbPath = resolveConfiguredDbPath(configuredPath);
    assertBackendTestDbIsSafe(dbPath, isBackendTest);
    return dbPath;
  }
  if (isBackendTest) {
    const dbPath = resolveBackendTestDbPath();
    assertBackendTestDbIsSafe(dbPath, isBackendTest);
    return dbPath;
  }
  return DEFAULT_DB_PATH;
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

function isBackendTestRun(): boolean {
  return process.env.AITESTBENCH_BACKEND_TESTS === '1' || process.env.VITEST === 'true';
}

function resolveBackendTestDbPath(): string {
  const configuredPath = process.env.AITESTBENCH_BACKEND_TEST_DB_PATH?.trim();
  return configuredPath ? resolveConfiguredDbPath(configuredPath) : DEFAULT_BACKEND_TEST_DB_PATH;
}

function resolveConfiguredDbPath(configuredPath: string): string {
  if (configuredPath === ':memory:' || configuredPath.startsWith('file:')) {
    return configuredPath;
  }
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(repoRoot, configuredPath);
}

function assertBackendTestDbIsSafe(dbPath: string, isBackendTest: boolean): void {
  if (!isBackendTest || dbPath === ':memory:' || dbPath.startsWith('file:')) {
    return;
  }
  if (dbPath === DEFAULT_DB_PATH) {
    throw new Error(
      `Backend tests cannot use the production SQLite database at ${DEFAULT_DB_PATH}. ` +
        'Set BACKEND_TEST_DB_PATH or AITESTBENCH_DB_PATH to a dedicated test database.'
    );
  }
}
