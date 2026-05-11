import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDb, resetDbInstance, runSchema } from '../../src/models/db.js';
import { getLeaderboard } from '../../src/services/leaderboard-service.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(moduleDir, '../../src/models/schema.sql');

function seedServer(serverId = 'srv-lb') {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO inference_servers
      (server_id, display_name, active, archived, created_at, updated_at, runtime, endpoints, auth, capabilities, discovery, raw)
    VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    serverId, 'LB Test Server', now, now,
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
}) {
  const db = getDb();
  const { modelName, serverId = 'srv-lb', scores = 3, tags = [], createdAt = new Date().toISOString() } = opts;
  const promptId = crypto.randomUUID();
  db.prepare('INSERT INTO eval_prompts (id, text, tags, created_at) VALUES (?, ?, ?, ?)').run(
    promptId,
    `Prompt for ${modelName} ${Math.random()}`,
    JSON.stringify(tags),
    createdAt
  );
  const evalId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO evaluations (
      id, prompt_id, model_name, server_id, inference_config, answer_text,
      accuracy_score, relevance_score, coherence_score, completeness_score, helpfulness_score,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    evalId, promptId, modelName, serverId,
    JSON.stringify({ temperature: null, top_p: null, max_tokens: null, quantization_level: null }),
    'Answer text',
    scores, scores, scores, scores, scores,
    createdAt
  );
}

describe('getLeaderboard', () => {
  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitb-lb-unit-'));
    process.env.INFERHARNESS_DB_PATH = path.join(tmpDir, 'test.sqlite');
    resetDbInstance();
    runSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    seedServer();
  });

  afterEach(() => {
    resetDbInstance();
  });

  it('returns empty entries array when no evaluations exist', () => {
    const result = getLeaderboard({});
    expect(result.entries).toEqual([]);
  });

  it('computes correct composite_score as mean of five dimensions', () => {
    seedEvaluation({ modelName: 'model-a', scores: 4 });
    const result = getLeaderboard({});
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].composite_score).toBeCloseTo(4.0);
    expect(result.entries[0].avg_accuracy).toBeCloseTo(4.0);
  });

  it('ranks models by composite_score descending', () => {
    seedEvaluation({ modelName: 'model-low', scores: 2 });
    seedEvaluation({ modelName: 'model-high', scores: 5 });
    const result = getLeaderboard({});
    expect(result.entries[0].model_name).toBe('model-high');
    expect(result.entries[1].model_name).toBe('model-low');
  });

  it('uses alphabetical model_name as tiebreaker when composite scores are equal', () => {
    seedEvaluation({ modelName: 'zebra-model', scores: 4 });
    seedEvaluation({ modelName: 'alpha-model', scores: 4 });
    const result = getLeaderboard({});
    expect(result.entries[0].model_name).toBe('alpha-model');
    expect(result.entries[1].model_name).toBe('zebra-model');
  });

  it('assigns 1-based rank to each entry', () => {
    seedEvaluation({ modelName: 'model-1', scores: 5 });
    seedEvaluation({ modelName: 'model-2', scores: 3 });
    const result = getLeaderboard({});
    expect(result.entries[0].rank).toBe(1);
    expect(result.entries[1].rank).toBe(2);
  });
});

describe('getLeaderboard performance benchmark', () => {
  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitb-lb-perf-'));
    process.env.INFERHARNESS_DB_PATH = path.join(tmpDir, 'test.sqlite');
    resetDbInstance();
    runSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    seedServer('srv-perf');
  });

  afterEach(() => {
    resetDbInstance();
  });

  it('p95 ≤ 200 ms for 5,000 evaluations across 50 distinct model names', () => {
    const db = getDb();
    const modelNames = Array.from({ length: 50 }, (_, i) => `perf-model-${i.toString().padStart(2, '0')}`);

    const insertPrompt = db.prepare('INSERT INTO eval_prompts (id, text, tags, created_at) VALUES (?, ?, ?, ?)');
    const insertEval = db.prepare(`
      INSERT INTO evaluations (
        id, prompt_id, model_name, server_id, inference_config, answer_text,
        accuracy_score, relevance_score, coherence_score, completeness_score, helpfulness_score,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seed = db.transaction(() => {
      const base = new Date('2026-01-01T00:00:00.000Z').getTime();
      for (let i = 0; i < 5000; i++) {
        const promptId = crypto.randomUUID();
        const evalId = crypto.randomUUID();
        const modelName = modelNames[i % 50];
        const createdAt = new Date(base + i * 1000).toISOString();
        insertPrompt.run(promptId, `Prompt ${i}`, '[]', createdAt);
        insertEval.run(
          evalId, promptId, modelName, 'srv-perf',
          '{}', 'Answer',
          3, 4, 3, 4, 3,
          createdAt
        );
      }
    });

    seed();

    const runs = 20;
    const durations: number[] = [];
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      getLeaderboard({});
      durations.push(performance.now() - start);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(runs * 0.95) - 1];
    expect(p95).toBeLessThan(200);
  }, 30000);
});
