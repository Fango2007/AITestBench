import { getDb } from './db.js';
import { nowIso, parseJson, parseJsonArray, serializeJson } from './repositories.js';

export type RunGroupStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface RunGroupRecord {
  id: string;
  status: RunGroupStatus;
  selected_template_ids: string[];
  test_overrides: Record<string, unknown> | null;
  profile_id: string | null;
  profile_version: string | null;
  created_at: string;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
}

export interface RunGroupItemRecord {
  id: string;
  group_id: string;
  child_run_id: string;
  inference_server_id: string;
  model_id: string;
  stable_letter: string;
  accent_index: number;
  status: RunGroupStatus;
  failure_reason: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
}

export function insertRunGroup(input: {
  id: string;
  status: RunGroupStatus;
  selected_template_ids: string[];
  test_overrides?: Record<string, unknown> | null;
  profile_id?: string | null;
  profile_version?: string | null;
}): RunGroupRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO run_groups (
      id, status, selected_template_ids, test_overrides, profile_id, profile_version,
      created_at, started_at, ended_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.status,
    serializeJson(input.selected_template_ids),
    serializeJson(input.test_overrides ?? null),
    input.profile_id ?? null,
    input.profile_version ?? null,
    now,
    now,
    null,
    now
  );
  return {
    id: input.id,
    status: input.status,
    selected_template_ids: input.selected_template_ids,
    test_overrides: input.test_overrides ?? null,
    profile_id: input.profile_id ?? null,
    profile_version: input.profile_version ?? null,
    created_at: now,
    started_at: now,
    ended_at: null,
    updated_at: now
  };
}

export function insertRunGroupItem(input: {
  id: string;
  group_id: string;
  child_run_id: string;
  inference_server_id: string;
  model_id: string;
  stable_letter: string;
  accent_index: number;
  status: RunGroupStatus;
}): RunGroupItemRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO run_group_items (
      id, group_id, child_run_id, inference_server_id, model_id, stable_letter,
      accent_index, status, failure_reason, created_at, started_at, ended_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.group_id,
    input.child_run_id,
    input.inference_server_id,
    input.model_id,
    input.stable_letter,
    input.accent_index,
    input.status,
    null,
    now,
    null,
    null,
    now
  );
  return {
    ...input,
    failure_reason: null,
    created_at: now,
    started_at: null,
    ended_at: null,
    updated_at: now
  };
}

export function updateRunGroupStatus(
  id: string,
  status: RunGroupStatus,
  options?: { ended_at?: string | null }
): void {
  const db = getDb();
  const now = nowIso();
  db.prepare('UPDATE run_groups SET status = ?, ended_at = COALESCE(?, ended_at), updated_at = ? WHERE id = ?')
    .run(status, options?.ended_at ?? null, now, id);
}

export function updateRunGroupItemStatus(
  id: string,
  status: RunGroupStatus,
  options?: { failure_reason?: string | null; started_at?: string | null; ended_at?: string | null }
): void {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `UPDATE run_group_items
     SET status = ?,
         failure_reason = ?,
         started_at = COALESCE(?, started_at),
         ended_at = COALESCE(?, ended_at),
         updated_at = ?
     WHERE id = ?`
  ).run(status, options?.failure_reason ?? null, options?.started_at ?? null, options?.ended_at ?? null, now, id);
}

export function getRunGroup(id: string): RunGroupRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM run_groups WHERE id = ?').get(id) as
    | (Omit<RunGroupRecord, 'selected_template_ids' | 'test_overrides'> & {
        selected_template_ids: string;
        test_overrides: string | null;
      })
    | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    selected_template_ids: parseJsonArray(row.selected_template_ids),
    test_overrides: parseJson(row.test_overrides)
  };
}

export function listRunGroupItems(groupId: string): RunGroupItemRecord[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM run_group_items WHERE group_id = ? ORDER BY accent_index ASC')
    .all(groupId) as RunGroupItemRecord[];
}
