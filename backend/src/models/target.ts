import { getDb } from './db';
import { nowIso, parseJson, serializeJson } from './repositories';

export interface TargetRecord {
  id: string;
  name: string;
  base_url: string;
  auth_type: string | null;
  provider: 'openai' | 'ollama' | 'auto';
  auth_token_ref: string | null;
  default_model: string | null;
  default_params: Record<string, unknown> | null;
  timeouts: Record<string, unknown> | null;
  concurrency_limit: number | null;
  status: 'active' | 'archived';
  connectivity_status: 'pending' | 'ok' | 'failed';
  last_check_at: string | null;
  last_error: string | null;
  models: TargetModelSummary[] | null;
  created_at: string;
  updated_at: string;
}

export interface TargetModelSummary {
  id?: string | null;
  name: string;
  provider?: string | null;
  version?: string | null;
}

export function listTargets(): TargetRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM targets ORDER BY name ASC').all() as TargetRecord[];
  return rows.map((row) => ({
    ...row,
    default_params: parseJson(row.default_params as unknown as string),
    timeouts: parseJson(row.timeouts as unknown as string),
    models: parseJson(row.models as unknown as string)
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
    timeouts: parseJson(row.timeouts as unknown as string),
    models: parseJson(row.models as unknown as string)
  };
}

export function getTargetByName(name: string): TargetRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM targets WHERE name = ?').get(name) as TargetRecord | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    default_params: parseJson(row.default_params as unknown as string),
    timeouts: parseJson(row.timeouts as unknown as string),
    models: parseJson(row.models as unknown as string)
  };
}

export function createTarget(input: Omit<TargetRecord, 'created_at' | 'updated_at'>): TargetRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO targets (
      id, name, base_url, auth_type, provider, auth_token_ref, default_model,
      default_params, timeouts, concurrency_limit, status, connectivity_status,
      last_check_at, last_error, models, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.base_url,
    input.auth_type,
    input.provider,
    input.auth_token_ref,
    input.default_model,
    serializeJson(input.default_params),
    serializeJson(input.timeouts),
    input.concurrency_limit,
    input.status,
    input.connectivity_status,
    input.last_check_at,
    input.last_error,
    serializeJson(input.models),
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
     SET name = ?, base_url = ?, auth_type = ?, provider = ?, auth_token_ref = ?, default_model = ?,
         default_params = ?, timeouts = ?, concurrency_limit = ?, status = ?,
         connectivity_status = ?, last_check_at = ?, last_error = ?, models = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    merged.name,
    merged.base_url,
    merged.auth_type,
    merged.provider,
    merged.auth_token_ref,
    merged.default_model,
    serializeJson(merged.default_params),
    serializeJson(merged.timeouts),
    merged.concurrency_limit,
    merged.status,
    merged.connectivity_status,
    merged.last_check_at,
    merged.last_error,
    serializeJson(merged.models),
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
