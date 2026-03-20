import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb, resetDbInstance, runSchema } from '../../src/models/db.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  const deletes = [
    'DELETE FROM metric_samples',
    'DELETE FROM test_result_documents',
    'DELETE FROM test_results',
    'DELETE FROM runs',
    'DELETE FROM models',
    'DELETE FROM inference_servers'
  ];
  for (const statement of deletes) {
    try {
      db.prepare(statement).run();
    } catch {
      // Table may not exist before schema bootstrap in first test.
    }
  }
}

function seedMixedData() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(moduleDir, '../../src/models/schema.sql');
  runSchema(fs.readFileSync(schemaPath, 'utf8'));
  resetDb();
  const db = getDb();
  const now = new Date();
  const within = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const older = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO inference_servers (
      server_id, display_name, active, archived, created_at, updated_at, runtime,
      endpoints, auth, capabilities, discovery, raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'srv-1',
    'Local Server',
    1,
    0,
    within,
    within,
    JSON.stringify({ api: { schema_family: ['ollama'], api_version: '1.1.0' } }),
    JSON.stringify({ base_url: 'http://localhost:11434' }),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({ model_list: { normalised: [] } }),
    JSON.stringify({})
  );

  db.prepare(
    `INSERT INTO runs (
      id, inference_server_id, suite_id, test_id, profile_id, profile_version,
      status, started_at, ended_at, environment_snapshot, retention_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'run-recent',
    'srv-1',
    null,
    'latency-benchmark',
    null,
    null,
    'completed',
    within,
    within,
    JSON.stringify({ effective_config: { model: 'mistral:latest' } }),
    30
  );

  db.prepare(
    `INSERT INTO runs (
      id, inference_server_id, suite_id, test_id, profile_id, profile_version,
      status, started_at, ended_at, environment_snapshot, retention_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'run-old',
    'srv-1',
    null,
    'metadata-check',
    null,
    null,
    'completed',
    older,
    older,
    JSON.stringify({ effective_config: { model: 'mistral:latest' } }),
    30
  );

  db.prepare(
    `INSERT INTO test_results (
      id, run_id, test_id, verdict, failure_reason, metrics, artefacts, raw_events,
      repetition_stats, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'result-recent',
    'run-recent',
    'latency-benchmark',
    'pass',
    null,
    JSON.stringify({ latency_ms: 91 }),
    JSON.stringify({ note: 'ok' }),
    JSON.stringify([]),
    JSON.stringify({ repetitions: 1 }),
    within,
    within
  );

  db.prepare(
    `INSERT INTO test_results (
      id, run_id, test_id, verdict, failure_reason, metrics, artefacts, raw_events,
      repetition_stats, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'result-old',
    'run-old',
    'metadata-check',
    'pass',
    null,
    JSON.stringify({ status_code: 200 }),
    JSON.stringify({ response: 'ok' }),
    JSON.stringify([]),
    JSON.stringify({ repetitions: 1 }),
    older,
    older
  );
}

describe('dashboard results integration', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';

  beforeEach(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitestbench-dashboard-integration-'));
    process.env.AITESTBENCH_DB_PATH = path.join(tempDir, 'aitestbench.sqlite');
    resetDbInstance();
  });

  afterEach(() => {
    resetDb();
    resetDbInstance();
  });

  it('uses default 15-day window and omits older rows', async () => {
    const app = createServer();
    seedMixedData();
    const response = await app.inject({
      method: 'POST',
      url: '/dashboard-results/query',
      headers: AUTH_HEADERS,
      payload: {
        view_mode: 'separate'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.panels.some((panel: { test_ids: string[] }) => panel.test_ids.includes('metadata-check'))).toBe(false);
  });

  it('keeps results separate by default', async () => {
    const app = createServer();
    seedMixedData();
    const response = await app.inject({
      method: 'POST',
      url: '/dashboard-results/query',
      headers: AUTH_HEADERS,
      payload: {
        test_ids: ['latency-benchmark'],
        view_mode: 'separate'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.panels.every((panel: { grouped: boolean }) => panel.grouped === false)).toBe(true);
  });

  it('returns empty panels when filters exclude all data', async () => {
    const app = createServer();
    seedMixedData();
    const response = await app.inject({
      method: 'POST',
      url: '/dashboard-results/query',
      headers: AUTH_HEADERS,
      payload: {
        runtime_keys: ['non-existent-runtime'],
        view_mode: 'separate'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.panels).toHaveLength(0);
  });

  it('allows manual grouping for compatible selections', async () => {
    const app = createServer();
    seedMixedData();
    const response = await app.inject({
      method: 'POST',
      url: '/dashboard-results/query',
      headers: AUTH_HEADERS,
      payload: {
        test_ids: ['latency-benchmark'],
        view_mode: 'grouped',
        group_keys: ['runtime:Local Server|model:mistral:latest|metric:latency_ms']
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.panels).toHaveLength(1);
    expect(body.panels[0].grouped).toBe(true);
    expect(body.stats.query_duration_ms).toBeGreaterThanOrEqual(0);
  });
});
