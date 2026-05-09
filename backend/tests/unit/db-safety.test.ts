import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, describe, expect, it } from 'vitest';

import { resolvedDbPath } from '../../src/models/db.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const productionDbPath = path.resolve(repoRoot, 'backend', 'data', 'db', 'aitestbench.sqlite');
const backendTestDbPath = path.resolve(repoRoot, 'backend', 'data', 'db', 'backend-test.sqlite');
const dbEnvKeys = [
  'AITESTBENCH_BACKEND_TESTS',
  'AITESTBENCH_DB_PATH',
  'AITESTBENCH_BACKEND_TEST_DB_PATH'
] as const;
const originalEnv = Object.fromEntries(dbEnvKeys.map((key) => [key, process.env[key]]));

describe('backend test database safety', () => {
  afterEach(() => {
    for (const key of dbEnvKeys) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('falls back to the dedicated backend test database during backend tests', () => {
    process.env.AITESTBENCH_BACKEND_TESTS = '1';
    delete process.env.AITESTBENCH_DB_PATH;
    delete process.env.AITESTBENCH_BACKEND_TEST_DB_PATH;

    expect(resolvedDbPath()).toBe(backendTestDbPath);
  });

  it('rejects the production SQLite database during backend tests', () => {
    process.env.AITESTBENCH_BACKEND_TESTS = '1';
    process.env.AITESTBENCH_DB_PATH = productionDbPath;

    expect(() => resolvedDbPath()).toThrow('Backend tests cannot use the production SQLite database');
  });
});
