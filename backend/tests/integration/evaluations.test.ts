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

function seedServer(serverId = 'srv-eval-test') {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO inference_servers
      (server_id, display_name, active, archived, created_at, updated_at, runtime, endpoints, auth, capabilities, discovery, raw)
    VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    serverId, 'Eval Test Server', now, now,
    JSON.stringify({ api: { schema_family: ['openai-compatible'], api_version: null } }),
    JSON.stringify({ base_url: 'http://localhost:9999' }),
    JSON.stringify({}), JSON.stringify({}), JSON.stringify({}), JSON.stringify({})
  );
  return serverId;
}

const VALID_EVAL_PAYLOAD = {
  prompt_text: 'What is 2+2?',
  tags: ['math'],
  server_id: 'srv-eval-test',
  model_name: 'llama3',
  inference_config: { temperature: 0.7, top_p: null, max_tokens: null, quantization_level: null },
  answer_text: '4',
  input_tokens: 10,
  output_tokens: 5,
  total_tokens: 15,
  latency_ms: 320.5,
  word_count: 1,
  estimated_cost: null,
  accuracy_score: 4,
  relevance_score: 5,
  coherence_score: 4,
  completeness_score: 5,
  helpfulness_score: 4,
  note: null
};

describe('POST /evaluations', () => {
  process.env.INFERHARNESS_API_TOKEN = 'test-token';

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitb-evaluations-'));
    process.env.INFERHARNESS_DB_PATH = path.join(tmpDir, 'test.sqlite');
    resetDbInstance();
    runSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  });

  afterEach(() => {
    resetDbInstance();
  });

  it('returns 201 with full record including prompt_id', async () => {
    const app = createServer();
    seedServer();
    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      headers: AUTH_HEADERS,
      payload: VALID_EVAL_PAYLOAD
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBeTruthy();
    expect(body.prompt_id).toBeTruthy();
    expect(body.model_name).toBe('llama3');
    expect(body.accuracy_score).toBe(4);
    expect(body.created_at).toBeTruthy();
  });

  it('returns 400 on schema validation failure (score out of range)', async () => {
    const app = createServer();
    seedServer();
    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      headers: AUTH_HEADERS,
      payload: { ...VALID_EVAL_PAYLOAD, accuracy_score: 10 }
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when required qualitative score is missing', async () => {
    const app = createServer();
    seedServer();
    const { accuracy_score: _, ...withoutScore } = VALID_EVAL_PAYLOAD;
    const response = await app.inject({
      method: 'POST',
      url: '/evaluations',
      headers: AUTH_HEADERS,
      payload: withoutScore
    });
    expect(response.statusCode).toBe(400);
  });

  it('reuses existing prompt when prompt_text already exists', async () => {
    const app = createServer();
    seedServer();
    const res1 = await app.inject({
      method: 'POST',
      url: '/evaluations',
      headers: AUTH_HEADERS,
      payload: VALID_EVAL_PAYLOAD
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/evaluations',
      headers: AUTH_HEADERS,
      payload: { ...VALID_EVAL_PAYLOAD, accuracy_score: 3 }
    });
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);
    expect(res1.json().prompt_id).toBe(res2.json().prompt_id);
  });
});

describe('GET /evaluations', () => {
  process.env.INFERHARNESS_API_TOKEN = 'test-token';

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitb-evaluations-get-'));
    process.env.INFERHARNESS_DB_PATH = path.join(tmpDir, 'test.sqlite');
    resetDbInstance();
    runSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  });

  afterEach(() => {
    resetDbInstance();
  });

  it('returns 200 with total and items array', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/evaluations',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.total).toBe('number');
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('respects limit and offset query params', async () => {
    const app = createServer();
    seedServer();
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: 'POST',
        url: '/evaluations',
        headers: AUTH_HEADERS,
        payload: { ...VALID_EVAL_PAYLOAD, accuracy_score: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5 }
      });
    }
    const response = await app.inject({
      method: 'GET',
      url: '/evaluations?limit=2&offset=0',
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
  });
});
