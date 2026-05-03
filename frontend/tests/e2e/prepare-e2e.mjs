import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');

function resolveFromRepo(value, fallback) {
  if (!value) {
    return fallback;
  }
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:18080';
const frontendBaseUrl = process.env.E2E_FRONTEND_BASE_URL ?? 'http://127.0.0.1:15173';
const dbPath = resolveFromRepo(
  process.env.AITESTBENCH_DB_PATH ?? process.env.E2E_DB_PATH,
  path.resolve(repoRoot, 'backend', 'data', 'db', 'e2e.sqlite')
);
const markerPath = resolveFromRepo(
  process.env.AITESTBENCH_E2E_MARKER_PATH,
  path.resolve(repoRoot, 'frontend', 'test-results', 'e2e-backend-startup.json')
);
const runtimeConfigPath = resolveFromRepo(
  process.env.E2E_RUNTIME_CONFIG,
  path.resolve(repoRoot, 'frontend', 'test-results', 'e2e-runtime.json')
);

for (const ext of ['', '-shm', '-wal']) {
  try {
    fs.unlinkSync(dbPath + ext);
  } catch {
    // File did not exist.
  }
}

try {
  fs.unlinkSync(markerPath);
} catch {
  // File did not exist.
}

fs.mkdirSync(path.dirname(runtimeConfigPath), { recursive: true });
fs.writeFileSync(
  runtimeConfigPath,
  JSON.stringify({ apiBaseUrl, frontendBaseUrl, dbPath, markerPath }, null, 2),
  'utf8'
);
