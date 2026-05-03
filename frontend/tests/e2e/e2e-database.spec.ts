import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const runtimeConfigPath = process.env.E2E_RUNTIME_CONFIG
  ? path.resolve(repoRoot, process.env.E2E_RUNTIME_CONFIG)
  : path.resolve(repoRoot, 'frontend', 'test-results', 'e2e-runtime.json');

function runtimeConfig(): { apiBaseUrl: string; dbPath: string; markerPath: string } {
  return JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8')) as {
    apiBaseUrl: string;
    dbPath: string;
    markerPath: string;
  };
}

test('E2E backend uses a dedicated SQLite database', async ({ request }) => {
  const { apiBaseUrl, dbPath, markerPath } = runtimeConfig();
  await expect
    .poll(
      async () => {
        const response = await request.get(`${apiBaseUrl}/health`).catch(() => null);
        let reportedDbPath: string | null = null;
        if (response && !response.ok()) {
          return {
            fileExists: fs.existsSync(dbPath),
            markerExists: fs.existsSync(markerPath),
            reportedDbPath: `health status ${response.status()}`
          };
        }
        if (response) {
          try {
            const payload = (await response.json()) as { db_path?: string };
            reportedDbPath = payload.db_path ? path.resolve(payload.db_path) : null;
          } catch {
            reportedDbPath = null;
          }
        }
        return {
          fileExists: fs.existsSync(dbPath),
          markerExists: fs.existsSync(markerPath),
          reportedDbPath
        };
      },
      { timeout: 5_000 }
    )
    .toEqual({ fileExists: true, markerExists: true, reportedDbPath: dbPath });
});
