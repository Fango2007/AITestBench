import crypto from 'crypto';

import { getDb } from '../models/db.js';
import { getInferenceServerById } from '../models/inference-server.js';
import { nowIso, parseJson } from '../models/repositories.js';
import { getRetentionDays } from './retention.js';
import { executeRun, RunExecutionResult } from './run-executor.js';

export interface RunRecord {
  id: string;
  inference_server_id: string;
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
  inference_server_id: string;
  test_id?: string | null;
  suite_id?: string | null;
  profile_id?: string | null;
  profile_version?: string | null;
  test_overrides?: Record<string, unknown> | null;
  profile_defaults?: Record<string, unknown> | null;
  model_metadata?: Record<string, unknown> | null;
  environment_snapshot?: Record<string, unknown> | null;
}

export function resolveOverrides(input: CreateRunInput): Record<string, unknown> {
  return {
    ...(input.profile_defaults ?? {}),
    ...(input.test_overrides ?? {})
  };
}
function buildRunId(input: CreateRunInput): string {
  const key = `${input.inference_server_id}:${input.test_id ?? input.suite_id}:${Date.now()}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

function insertRunRecord(
  input: CreateRunInput,
  status: string,
  startedAt: string,
  environmentSnapshot: Record<string, unknown>,
  retentionDays: number,
  id: string
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO runs (
      id, inference_server_id, suite_id, test_id, profile_id, profile_version,
      status, started_at, ended_at, environment_snapshot, retention_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.inference_server_id,
    input.suite_id ?? null,
    input.test_id ?? null,
    input.profile_id ?? null,
    input.profile_version ?? null,
    status,
    startedAt,
    null,
    JSON.stringify(environmentSnapshot),
    retentionDays
  );
}

function updateRunStatus(id: string, status: string, endedAt: string): void {
  const db = getDb();
  db.prepare('UPDATE runs SET status = ?, ended_at = ? WHERE id = ?').run(status, endedAt, id);
}

function insertTestResult(runId: string, result: RunExecutionResult['results'][number]): void {
  const db = getDb();
  const id = crypto.createHash('sha256').update(`${runId}:${result.test_id}:${Date.now()}`).digest('hex').slice(0, 20);
  db.prepare(
    `INSERT INTO test_results (
      id, run_id, test_id, verdict, failure_reason, metrics, artefacts, raw_events,
      repetition_stats, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    runId,
    result.test_id,
    result.verdict,
    result.failure_reason,
    result.metrics ? JSON.stringify(result.metrics) : null,
    result.artefacts ? JSON.stringify(result.artefacts) : null,
    result.raw_events ? JSON.stringify(result.raw_events) : null,
    JSON.stringify({ repetitions: 1 }),
    result.started_at,
    result.ended_at
  );
}

export async function createSingleRun(input: CreateRunInput): Promise<RunRecord> {
  const now = nowIso();
  const retentionDays = getRetentionDays();
  const id = buildRunId(input);
  const server = getInferenceServerById(input.inference_server_id);
  if (!server) {
    throw new Error(`Inference server not found: ${input.inference_server_id}`);
  }
  const effectiveConfig = resolveOverrides({ ...input });
  const environmentSnapshot = {
    ...input.environment_snapshot,
    effective_config: effectiveConfig,
    model_metadata: input.model_metadata ?? null
  };

  insertRunRecord(input, 'running', now, environmentSnapshot, retentionDays, id);

  const execution = await executeRun({
    run_id: id,
    inference_server_id: input.inference_server_id,
    test_id: input.test_id ?? null,
    suite_id: input.suite_id ?? null,
    profile_id: input.profile_id ?? null,
    profile_version: input.profile_version ?? null,
    effective_config: effectiveConfig
  });

  for (const result of execution.results) {
    insertTestResult(id, result);
  }

  updateRunStatus(id, execution.status, execution.ended_at);

  return {
    id,
    inference_server_id: input.inference_server_id,
    suite_id: input.suite_id ?? null,
    test_id: input.test_id ?? null,
    profile_id: input.profile_id ?? null,
    profile_version: input.profile_version ?? null,
    status: execution.status,
    started_at: now,
    ended_at: execution.ended_at,
    environment_snapshot: environmentSnapshot,
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
