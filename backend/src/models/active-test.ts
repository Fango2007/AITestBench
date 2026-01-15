import { getDb } from './db.js';
import { nowIso } from './repositories.js';

export interface ActiveTestRecord {
  id: string;
  template_id: string;
  template_version: string;
  inference_server_id: string;
  model_name: string;
  status: string;
  created_at: string;
  deleted_at: string | null;
  version: string;
  command_preview: string | null;
  python_ready: boolean;
}

export function createActiveTest(
  input: Omit<ActiveTestRecord, 'created_at' | 'deleted_at'>
): ActiveTestRecord {
  const db = getDb();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO active_tests (
      id, template_id, template_version, inference_server_id, model_name,
      status, created_at, deleted_at, version, command_preview, python_ready
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.template_id,
    input.template_version,
    input.inference_server_id,
    input.model_name,
    input.status,
    createdAt,
    null,
    input.version,
    input.command_preview,
    input.python_ready ? 1 : 0
  );

  return { ...input, created_at: createdAt, deleted_at: null };
}

export function listActiveTests(): ActiveTestRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM active_tests WHERE deleted_at IS NULL ORDER BY created_at DESC')
    .all() as Array<ActiveTestRecord & { python_ready: number }>;

  return rows.map((row) => ({
    ...row,
    python_ready: Boolean(row.python_ready)
  }));
}

export function deleteActiveTest(id: string): boolean {
  const db = getDb();
  const deletedAt = nowIso();
  const result = db
    .prepare('UPDATE active_tests SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(deletedAt, id);
  return result.changes > 0;
}
