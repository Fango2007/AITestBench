import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const DEFAULT_BACKEND_TEST_DB_PATH = path.resolve(repoRoot, 'backend', 'data', 'db', 'backend-test.sqlite');

function resolveFromRepo(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

export function backendTestDbPath(): string {
  return resolveFromRepo(
    process.env.BACKEND_TEST_DB_PATH ?? process.env.INFERHARNESS_BACKEND_TEST_DB_PATH,
    DEFAULT_BACKEND_TEST_DB_PATH
  );
}

export function applyBackendTestDbEnv(): string {
  const dbPath = backendTestDbPath();
  process.env.INFERHARNESS_BACKEND_TESTS = '1';
  process.env.INFERHARNESS_BACKEND_TEST_DB_PATH = dbPath;
  process.env.INFERHARNESS_DB_PATH = dbPath;
  return dbPath;
}

export function removeSqliteFiles(dbPath: string): void {
  for (const ext of ['', '-shm', '-wal']) {
    try {
      fs.unlinkSync(dbPath + ext);
    } catch {
      // File did not exist.
    }
  }
}
