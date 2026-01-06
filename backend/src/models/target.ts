import { getDb } from './db';
import { nowIso, parseJson, serializeJson } from './repositories';

export interface TargetRecord {
  id: string;
  name: string;
  base_url: string;
  auth_type: string | null;
  auth_token_ref: string | null;
  default_model: string | null;
  default_params: Record<string, unknown> | null;
  timeouts: Record<string, unknown> | null;
  concurrency_limit: number | null;
  created_at: string;
  updated_at: string;
}

export function listTargets(): TargetRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM targets ORDER BY name ASC').all() as TargetRecord[];
  return rows.map((row) => ({
    ...row,
    default_params: parseJson(row.default_params as unknown as string),
    timeouts: parseJson(row.timeouts as unknown as string)
  }));
}

export function getTargetById(id: string): TargetRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM targets WHERE id = ?').get(id) as TargetRecord | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    default_params: parseJson(row.default_params as unknown as string),
    timeouts: parseJson(row.timeouts as unknown as string)
  };
}

export function createTarget(input: Omit<TargetRecord, 'created_at' | 'updated_at'>): TargetRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO targets (
      id, name, base_url, auth_type, auth_token_ref, default_model,
      default_params, timeouts, concurrency_limit, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.base_url,
    input.auth_type,
    input.auth_token_ref,
    input.default_model,
    serializeJson(input.default_params),
    serializeJson(input.timeouts),
    input.concurrency_limit,
    now,
    now
  );

  return { ...input, created_at: now, updated_at: now };
}

export function updateTarget(id: string, updates: Partial<TargetRecord>): TargetRecord | null {
  const existing = getTargetById(id);
  if (!existing) {
    return null;
  }
  const db = getDb();
  const now = nowIso();
  const merged: TargetRecord = {
    ...existing,
    ...updates,
    updated_at: now
  };

  db.prepare(
    `UPDATE targets
     SET name = ?, base_url = ?, auth_type = ?, auth_token_ref = ?, default_model = ?,
         default_params = ?, timeouts = ?, concurrency_limit = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    merged.name,
    merged.base_url,
    merged.auth_type,
    merged.auth_token_ref,
    merged.default_model,
    serializeJson(merged.default_params),
    serializeJson(merged.timeouts),
    merged.concurrency_limit,
    merged.updated_at,
    id
  );

  return merged;
}

export function deleteTarget(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM targets WHERE id = ?').run(id);
  return result.changes > 0;
}
