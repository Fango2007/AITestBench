import crypto from 'crypto';

import { getDb } from '../models/db';
import { nowIso, parseJson } from '../models/repositories';
import { getRetentionDays } from './retention';

export interface RunRecord {
  id: string;
  target_id: string;
  suite_id: string | null;
  test_id: string | null;
  profile_id: string | null;
  profile_version: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  environment_snapshot: Record<string, unknown> | null;
  retention_days: number | null;
}

export interface RunResultRecord {
  id: string;
  run_id: string;
  test_id: string;
  verdict: string;
  failure_reason: string | null;
  metrics: Record<string, unknown> | null;
  artefacts: Record<string, unknown> | null;
  raw_events: Record<string, unknown>[] | null;
  repetition_stats: Record<string, unknown> | null;
  started_at: string;
  ended_at: string | null;
}

export interface CreateRunInput {
  target_id: string;
  test_id?: string | null;
  suite_id?: string | null;
  profile_id?: string | null;
  profile_version?: string | null;
  test_overrides?: Record<string, unknown> | null;
  profile_defaults?: Record<string, unknown> | null;
  target_defaults?: Record<string, unknown> | null;
  model_metadata?: Record<string, unknown> | null;
  environment_snapshot?: Record<string, unknown> | null;
}

export function resolveOverrides(input: CreateRunInput): Record<string, unknown> {
  return {
    ...(input.target_defaults ?? {}),
    ...(input.profile_defaults ?? {}),
    ...(input.test_overrides ?? {})
  };
}
function buildRunId(input: CreateRunInput): string {
  const key = `${input.target_id}:${input.test_id ?? input.suite_id}:${Date.now()}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

export function createSingleRun(input: CreateRunInput): RunRecord {
  const db = getDb();
  const now = nowIso();
  const retentionDays = getRetentionDays();
  const id = buildRunId(input);
  const effectiveConfig = resolveOverrides(input);

  db.prepare(
    `INSERT INTO runs (
      id, target_id, suite_id, test_id, profile_id, profile_version,
      status, started_at, ended_at, environment_snapshot, retention_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.target_id,
    input.suite_id ?? null,
    input.test_id ?? null,
    input.profile_id ?? null,
    input.profile_version ?? null,
    'completed',
    now,
    now,
    JSON.stringify({
      ...input.environment_snapshot,
      effective_config: effectiveConfig,
      model_metadata: input.model_metadata ?? null
    }),
    retentionDays
  );

  return {
    id,
    target_id: input.target_id,
    suite_id: null,
    test_id: input.test_id ?? null,
    profile_id: input.profile_id ?? null,
    profile_version: input.profile_version ?? null,
    status: 'completed',
    started_at: now,
    ended_at: now,
    environment_snapshot: {
      ...input.environment_snapshot,
      effective_config: effectiveConfig,
      model_metadata: input.model_metadata ?? null
    },
    retention_days: retentionDays
  };
}

export function getRun(id: string): RunRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRecord | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    environment_snapshot: parseJson(row.environment_snapshot as unknown as string)
  };
}

export function listRunResults(runId: string): RunResultRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM test_results WHERE run_id = ?')
    .all(runId) as RunResultRecord[];

  return rows.map((row) => ({
    ...row,
    metrics: parseJson(row.metrics as unknown as string),
    artefacts: parseJson(row.artefacts as unknown as string),
    raw_events: parseJson(row.raw_events as unknown as string),
    repetition_stats: parseJson(row.repetition_stats as unknown as string)
  }));
}
