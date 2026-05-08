import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb, resetDbInstance, runSchema } from '../../src/models/db.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(moduleDir, '../../src/models/schema.sql');

function seedServer(serverId = 'srv-results') {
  const db = getDb();
  const now = '2026-05-01T00:00:00.000Z';
  db.prepare(`
    INSERT INTO inference_servers (
      server_id, display_name, active, archived, created_at, updated_at, runtime,
      endpoints, auth, capabilities, discovery, raw
    ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    serverId,
    'Results Server',
    now,
    now,
    JSON.stringify({ api: { api_version: '1.0.0' } }),
    JSON.stringify({ base_url: 'http://localhost:8080' }),
    JSON.stringify({}),
    JSON.stringify({}),
    JSON.stringify({ model_list: { normalised: [] } }),
    JSON.stringify({})
  );
  return serverId;
}

function seedRun(input: {
  runId: string;
  model: string;
  verdict: 'pass' | 'fail';
  startedAt: string;
  latency: number;
  templateId?: string;
}) {
  const db = getDb();
  const templateId = input.templateId ?? 'cold-start';
  db.prepare(`
    INSERT INTO active_tests (
      id, template_id, template_version, inference_server_id, model_name,
      status, created_at, deleted_at, version, command_preview, python_ready
    ) VALUES (?, ?, '1.0.0', 'srv-results', ?, 'active', ?, null, '1.0.0', null, 1)
  `).run(`${templateId}-${input.runId}`, templateId, input.model, input.startedAt);

  db.prepare(`
    INSERT INTO runs (
      id, inference_server_id, suite_id, test_id, profile_id, profile_version,
      status, started_at, ended_at, environment_snapshot, retention_days
    ) VALUES (?, 'srv-results', null, ?, null, null, 'completed', ?, ?, ?, 30)
  `).run(
    input.runId,
    `${templateId}-${input.runId}`,
    input.startedAt,
    input.startedAt,
    JSON.stringify({ effective_config: { model: input.model } })
  );

  const resultId = `result-${input.runId}`;
  db.prepare(`
    INSERT INTO test_results (
      id, run_id, test_id, verdict, failure_reason, metrics, artefacts, raw_events,
      repetition_stats, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?)
  `).run(
    resultId,
    input.runId,
    `${templateId}-${input.runId}`,
    input.verdict,
    input.verdict === 'fail' ? 'assertion failed' : null,
    JSON.stringify({ latency_ms: input.latency, estimated_cost: 0.001 }),
    JSON.stringify({}),
    JSON.stringify({ repetitions: 1 }),
    input.startedAt,
    input.startedAt
  );

  db.prepare(`
    INSERT INTO test_result_documents (test_result_id, run_id, test_id, schema_version, document, created_at)
    VALUES (?, ?, ?, '1.0.0', ?, ?)
  `).run(
    resultId,
    input.runId,
    `${templateId}-${input.runId}`,
    JSON.stringify({ test: { tags: ['nightly'], type: 'scenario-json' }, selected_model: { id: input.model }, steps: [] }),
    input.startedAt
  );
}

describe('results-view routes', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitb-results-view-'));
    process.env.AITESTBENCH_DB_PATH = path.join(tmpDir, 'test.sqlite');
    resetDbInstance();
    runSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    seedServer();
  });

  afterEach(() => {
    resetDbInstance();
  });

  it('returns empty dashboard/history structures for an empty database window', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'POST',
      url: '/results-view/query',
      headers: AUTH_HEADERS,
      payload: { date_from: '2026-05-01T00:00:00.000Z', date_to: '2026-05-02T00:00:00.000Z' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().dashboard.scorecards.total_runs).toBe(0);
    expect(response.json().history.rows).toEqual([]);
  });

  it('filters run-backed history by status, model, score and tag', async () => {
    const app = createServer();
    seedRun({ runId: 'run-pass', model: 'model-a', verdict: 'pass', startedAt: '2026-05-01T10:00:00.000Z', latency: 100 });
    seedRun({ runId: 'run-fail', model: 'model-b', verdict: 'fail', startedAt: '2026-05-01T11:00:00.000Z', latency: 200 });

    const response = await app.inject({
      method: 'POST',
      url: '/results-view/query',
      headers: AUTH_HEADERS,
      payload: {
        date_from: '2026-05-01T00:00:00.000Z',
        date_to: '2026-05-02T00:00:00.000Z',
        statuses: ['pass'],
        model_names: ['model-a'],
        score_min: 90,
        tags: ['nightly']
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().history.rows).toHaveLength(1);
    expect(response.json().history.rows[0].run_id).toBe('run-pass');
  });

  it('opens run drawer detail for a history row', async () => {
    const app = createServer();
    seedRun({ runId: 'run-detail', model: 'model-a', verdict: 'pass', startedAt: '2026-05-01T10:00:00.000Z', latency: 100 });

    const response = await app.inject({
      method: 'GET',
      url: '/results-view/runs/run-detail',
      headers: AUTH_HEADERS
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().run.run_id).toBe('run-detail');
    expect(response.json().results[0].metrics.latency_ms).toBe(100);
  });
});
