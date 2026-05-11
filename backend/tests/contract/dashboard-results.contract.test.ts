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

function seedDashboardData() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(moduleDir, '../../src/models/schema.sql');
  runSchema(fs.readFileSync(schemaPath, 'utf8'));
  resetDb();
  const db = getDb();
  const now = new Date();
  const within = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

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
    JSON.stringify({ api: { schema_family: ['ollama'], api_version: '1.0.0' } }),
    JSON.stringify({ base_url: 'http://localhost:11434' }),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({ model_list: { normalised: [] } }),
    JSON.stringify({})
  );

  db.prepare(
    `INSERT INTO models (
      server_id, model_id, display_name, active, archived, created_at, updated_at,
      model_schema_version, identity, architecture, modalities, capabilities,
      limits, performance, configuration, discovery, raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'srv-1',
    'mistral:latest',
    'Mistral',
    1,
    0,
    within,
    within,
    '1.0.0',
    JSON.stringify({ provider: 'custom' }),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({})
  );

  db.prepare(
    `INSERT INTO runs (
      id, inference_server_id, suite_id, test_id, profile_id, profile_version,
      status, started_at, ended_at, environment_snapshot, retention_days
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'run-1',
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
    `INSERT INTO test_results (
      id, run_id, test_id, verdict, failure_reason, metrics, artefacts, raw_events,
      repetition_stats, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'result-1',
    'run-1',
    'latency-benchmark',
    'pass',
    null,
    JSON.stringify({ latency_ms: 120, quality_score: 0.89 }),
    JSON.stringify({ note: 'ok' }),
    JSON.stringify([]),
    JSON.stringify({ repetitions: 1 }),
    within,
    within
  );
}

describe('dashboard results contract', () => {
  process.env.INFERHARNESS_API_TOKEN = 'test-token';

  beforeEach(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inferharness-dashboard-contract-'));
    process.env.INFERHARNESS_DB_PATH = path.join(tempDir, 'inferharness.sqlite');
    resetDbInstance();
  });

  afterEach(() => {
    resetDb();
    resetDbInstance();
  });

  it('returns filter options payload', async () => {
    const app = createServer();
    seedDashboardData();
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard-results/filters',
      headers: AUTH_HEADERS
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.runtimes)).toBe(true);
    expect(Array.isArray(body.server_versions)).toBe(true);
    expect(Array.isArray(body.models)).toBe(true);
    expect(Array.isArray(body.tests)).toBe(true);
    expect(body.default_window_days).toBe(15);
  });

  it('returns query payload with panels and stats', async () => {
    const app = createServer();
    seedDashboardData();
    const response = await app.inject({
      method: 'POST',
      url: '/dashboard-results/query',
      headers: AUTH_HEADERS,
      payload: {
        runtime_keys: ['Local Server'],
        test_ids: ['latency-benchmark'],
        view_mode: 'separate'
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body.panels)).toBe(true);
    expect(body.stats.raw_results_returned).toBeGreaterThanOrEqual(1);
    expect(body.panels[0].presentation_type).toBe('performance_graph');
  });

  it('rejects grouped mode without group keys', async () => {
    const app = createServer();
    seedDashboardData();
    const response = await app.inject({
      method: 'POST',
      url: '/dashboard-results/query',
      headers: AUTH_HEADERS,
      payload: {
        view_mode: 'grouped',
        test_ids: ['latency-benchmark']
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('GROUP_KEYS_REQUIRED');
  });

  it('rejects incompatible grouping keys', async () => {
    const app = createServer();
    seedDashboardData();
    const response = await app.inject({
      method: 'POST',
      url: '/dashboard-results/query',
      headers: AUTH_HEADERS,
      payload: {
        view_mode: 'grouped',
        test_ids: ['latency-benchmark'],
        group_keys: ['runtime:unknown|model:unknown|metric:missing']
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('INCOMPATIBLE_GROUPING');
  });
});
