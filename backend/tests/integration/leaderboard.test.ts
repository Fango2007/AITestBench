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

function seedServer(serverId = 'srv-lb-int') {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO inference_servers
      (server_id, display_name, active, archived, created_at, updated_at, runtime, endpoints, auth, capabilities, discovery, raw)
    VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    serverId, 'LB Integration Server', now, now,
    JSON.stringify({}), JSON.stringify({ base_url: 'http://localhost:9999' }),
    JSON.stringify({}), JSON.stringify({}), JSON.stringify({}), JSON.stringify({})
  );
  return serverId;
}

function seedEvaluation(opts: {
  modelName: string;
  serverId?: string;
  scores?: number;
  tags?: string[];
  createdAt?: string;
  latencyMs?: number;
  estimatedCost?: number;
  quantization?: string | null;
}) {
  const db = getDb();
  const {
    modelName,
    serverId = 'srv-lb-int',
    scores = 3,
    tags = [],
    createdAt = new Date().toISOString(),
    latencyMs = null,
    estimatedCost = null,
    quantization = null
  } = opts;
  const promptId = crypto.randomUUID();
  db.prepare('INSERT INTO eval_prompts (id, text, tags, created_at) VALUES (?, ?, ?, ?)').run(
    promptId,
    `Prompt ${Math.random()}`,
    JSON.stringify(tags),
    createdAt
  );
  const evalId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO evaluations (
      id, prompt_id, model_name, server_id, inference_config, answer_text,
      latency_ms, estimated_cost,
      accuracy_score, relevance_score, coherence_score, completeness_score, helpfulness_score,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    evalId, promptId, modelName, serverId,
    JSON.stringify({ temperature: null, top_p: null, max_tokens: null, quantization_level: quantization }),
    'Answer',
    latencyMs,
    estimatedCost,
    scores, scores, scores, scores, scores,
    createdAt
  );
  return evalId;
}

describe('GET /leaderboard', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitb-lb-int-'));
    process.env.AITESTBENCH_DB_PATH = path.join(tmpDir, 'test.sqlite');
    resetDbInstance();
    runSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    seedServer();
  });

  afterEach(() => {
    resetDbInstance();
  });

  it('returns 200 with empty entries array when no evaluations', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/leaderboard', headers: AUTH_HEADERS });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.entries).toEqual([]);
    expect(body.filters_applied).toBeDefined();
  });

  it('returns entries in correct rank order', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'low-model', scores: 2 });
    seedEvaluation({ modelName: 'high-model', scores: 5 });
    const response = await app.inject({ method: 'GET', url: '/leaderboard', headers: AUTH_HEADERS });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.entries[0].model_name).toBe('high-model');
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[1].rank).toBe(2);
  });

  it('always contains filters_applied object', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/leaderboard', headers: AUTH_HEADERS });
    const body = response.json();
    expect(body.filters_applied).toHaveProperty('date_from');
    expect(body.filters_applied).toHaveProperty('date_to');
    expect(body.filters_applied).toHaveProperty('tags');
  });

  it('returns 400 for malformed date_from', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/leaderboard?date_from=not-a-date',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for malformed date_to', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/leaderboard?date_to=bad-date',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 401 for missing x-api-token', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/leaderboard' });
    expect(response.statusCode).toBe(401);
  });

  // T036 [US3] — date-range and tag filter integration tests
  it('applies date_from filter to limit evaluations', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'model-a', scores: 5, createdAt: '2026-01-01T00:00:00.000Z' });
    seedEvaluation({ modelName: 'model-b', scores: 3, createdAt: '2026-03-01T00:00:00.000Z' });
    const response = await app.inject({
      method: 'GET',
      url: '/leaderboard?date_from=2026-02-01',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const names = body.entries.map((e: { model_name: string }) => e.model_name);
    expect(names).not.toContain('model-a');
    expect(names).toContain('model-b');
  });

  it('applies date_to filter', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'model-early', scores: 5, createdAt: '2026-01-01T00:00:00.000Z' });
    seedEvaluation({ modelName: 'model-late', scores: 3, createdAt: '2026-06-01T00:00:00.000Z' });
    const response = await app.inject({
      method: 'GET',
      url: '/leaderboard?date_to=2026-03-01',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const names = body.entries.map((e: { model_name: string }) => e.model_name);
    expect(names).toContain('model-early');
    expect(names).not.toContain('model-late');
  });

  it('applies tag filter with OR logic', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'model-science', scores: 4, tags: ['science'] });
    seedEvaluation({ modelName: 'model-math', scores: 3, tags: ['math'] });
    seedEvaluation({ modelName: 'model-other', scores: 5, tags: ['cooking'] });
    const response = await app.inject({
      method: 'GET',
      url: '/leaderboard?tags=science,math',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const names = body.entries.map((e: { model_name: string }) => e.model_name);
    expect(names).toContain('model-science');
    expect(names).toContain('model-math');
    expect(names).not.toContain('model-other');
  });

  it('returns empty entries when tag filter matches nothing', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'model-x', scores: 4, tags: ['physics'] });
    const response = await app.inject({
      method: 'GET',
      url: '/leaderboard?tags=nonexistent-tag',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().entries).toEqual([]);
  });

  it('returns all records when no filters applied after a filtered call', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'model-a', scores: 4, tags: ['tagA'] });
    seedEvaluation({ modelName: 'model-b', scores: 3, tags: ['tagB'] });
    const filtered = await app.inject({
      method: 'GET',
      url: '/leaderboard?tags=tagA',
      headers: AUTH_HEADERS
    });
    expect(filtered.json().entries).toHaveLength(1);

    const unfiltered = await app.inject({ method: 'GET', url: '/leaderboard', headers: AUTH_HEADERS });
    expect(unfiltered.json().entries).toHaveLength(2);
  });

  it('returns empty entries after clearing the database from settings', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'model-before-clear', scores: 5, tags: ['cleanup'] });

    const populated = await app.inject({ method: 'GET', url: '/leaderboard', headers: AUTH_HEADERS });
    expect(populated.json().entries).toHaveLength(1);

    const clearResponse = await app.inject({ method: 'POST', url: '/system/clear-db', headers: AUTH_HEADERS });
    expect(clearResponse.statusCode).toBe(200);

    const cleared = await app.inject({ method: 'GET', url: '/leaderboard', headers: AUTH_HEADERS });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().entries).toEqual([]);

    const db = getDb();
    expect(db.prepare('SELECT COUNT(*) AS count FROM evaluations').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT COUNT(*) AS count FROM eval_prompts').get()).toEqual({ count: 0 });
  });

  it('applies server, model, score, sort and group filters without changing evaluation backing', async () => {
    const app = createServer();
    seedServer('srv-alt');
    seedEvaluation({ modelName: 'model-a', serverId: 'srv-lb-int', scores: 5, latencyMs: 200, quantization: 'Q4' });
    seedEvaluation({ modelName: 'model-b', serverId: 'srv-alt', scores: 2, latencyMs: 50, quantization: 'Q8' });

    const filtered = await app.inject({
      method: 'GET',
      url: '/leaderboard?server_ids=srv-lb-int&model_names=model-a&score_min=90&sort_by=latency&group_by=server',
      headers: AUTH_HEADERS
    });

    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].group_by).toBe('server');
    expect(body.entries[0].server_id).toBe('srv-lb-int');
    expect(body.entries[0].representative_evaluation_id).toBeTruthy();
  });

  it('groups leaderboard entries by quantization level', async () => {
    const app = createServer();
    seedEvaluation({ modelName: 'model-a', scores: 5, quantization: 'Q4' });
    seedEvaluation({ modelName: 'model-b', scores: 4, quantization: 'Q4' });
    seedEvaluation({ modelName: 'model-c', scores: 3, quantization: 'Q8' });

    const response = await app.inject({
      method: 'GET',
      url: '/leaderboard?group_by=quantization',
      headers: AUTH_HEADERS
    });

    expect(response.statusCode).toBe(200);
    const labels = response.json().entries.map((entry: { group_label: string }) => entry.group_label);
    expect(labels).toContain('Q4');
    expect(labels).toContain('Q8');
  });
});
