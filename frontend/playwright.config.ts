import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const frontendBaseUrl =
  env.E2E_FRONTEND_BASE_URL ?? 'http://localhost:5173';
const apiBaseUrl =
  env.E2E_API_BASE_URL ?? 'http://localhost:8080';
const dbPath = env.AITESTBENCH_DB_PATH
  ? path.resolve(repoRoot, env.AITESTBENCH_DB_PATH)
  : path.resolve(repoRoot, 'data', 'e2e.sqlite');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: frontendBaseUrl,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run e2e:serve',
    url: frontendBaseUrl,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    cwd: repoRoot,
    env: {
      ...process.env,
      ...rawEnv,
      AITESTBENCH_DB_PATH: dbPath,
      E2E_API_BASE_URL: apiBaseUrl,
      E2E_FRONTEND_BASE_URL: frontendBaseUrl,
      VITE_AITESTBENCH_API_BASE_URL: apiBaseUrl,
      VITE_AITESTBENCH_FRONTEND_BASE_URL: frontendBaseUrl
    }
  }
});
