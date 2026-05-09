import { applyBackendTestDbEnv, removeSqliteFiles } from './support/backend-test-db.js';

export default function setupBackendTestDb(): void {
  const dbPath = applyBackendTestDbEnv();
  removeSqliteFiles(dbPath);
}
