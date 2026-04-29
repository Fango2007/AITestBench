import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const dbPath = process.env.E2E_DB_PATH
  ? path.resolve(repoRoot, process.env.E2E_DB_PATH)
  : path.resolve(repoRoot, 'backend', 'data', 'db', 'e2e.sqlite');

export default async function globalSetup() {
  for (const ext of ['', '-shm', '-wal']) {
    const file = dbPath + ext;
    try { fs.unlinkSync(file); } catch { /* file did not exist */ }
  }
}
