import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const frontendBaseUrl =
  env.E2E_FRONTEND_BASE_URL ?? 'http://127.0.0.1:15173';
const apiBaseUrl =
  env.E2E_API_BASE_URL ?? 'http://127.0.0.1:18080';
function portFromUrl(value: string, fallback: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.port) {
      return parsed.port;
    }
    return parsed.protocol === 'https:' ? '443' : '80';
  } catch {
    return fallback;
  }
}
const apiPort = portFromUrl(apiBaseUrl, '8080');
// Deliberately ignore INFERHARNESS_DB_PATH from .env (which points to the production DB).
// Tests always use a dedicated e2e.sqlite; override with E2E_DB_PATH if needed.
const dbPath = process.env.E2E_DB_PATH
  ? path.resolve(repoRoot, process.env.E2E_DB_PATH)
  : path.resolve(repoRoot, 'backend', 'data', 'db', 'e2e.sqlite');
const runtimeConfigPath = path.resolve(repoRoot, 'frontend', 'test-results', 'e2e-runtime.json');
const markerPath = path.resolve(repoRoot, 'frontend', 'test-results', 'e2e-backend-startup.json');

process.env.E2E_API_BASE_URL = apiBaseUrl;
process.env.E2E_FRONTEND_BASE_URL = frontendBaseUrl;
process.env.E2E_DB_PATH = dbPath;
process.env.E2E_RUNTIME_CONFIG = runtimeConfigPath;
process.env.VITE_INFERHARNESS_API_BASE_URL = apiBaseUrl;
process.env.VITE_INFERHARNESS_FRONTEND_BASE_URL = frontendBaseUrl;

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
  webServer: [
    {
      command: 'node frontend/tests/e2e/prepare-e2e.mjs && npm run start:backend',
      url: `${apiBaseUrl}/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      cwd: repoRoot,
      env: {
        ...process.env,
        ...rawEnv,
        INFERHARNESS_E2E: '1',
        INFERHARNESS_DB_PATH: dbPath,
        INFERHARNESS_E2E_MARKER_PATH: markerPath,
        PORT: apiPort,
        E2E_API_BASE_URL: apiBaseUrl,
        E2E_RUNTIME_CONFIG: runtimeConfigPath,
        E2E_FRONTEND_BASE_URL: frontendBaseUrl,
        VITE_INFERHARNESS_API_BASE_URL: apiBaseUrl,
        VITE_INFERHARNESS_FRONTEND_BASE_URL: frontendBaseUrl
      }
    },
    {
      command: 'npm -w frontend run dev',
      url: frontendBaseUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      cwd: repoRoot,
      env: {
        ...process.env,
        ...rawEnv,
        E2E_API_BASE_URL: apiBaseUrl,
        E2E_RUNTIME_CONFIG: runtimeConfigPath,
        E2E_FRONTEND_BASE_URL: frontendBaseUrl,
        VITE_INFERHARNESS_API_BASE_URL: apiBaseUrl,
        VITE_INFERHARNESS_FRONTEND_BASE_URL: frontendBaseUrl
      }
    }
  ]
});
