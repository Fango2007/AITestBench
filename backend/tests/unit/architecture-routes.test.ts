import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../../src/adapters/architecture-inspector.js', () => {
  const validTree = {
    schema_version: '1.0.0',
    model_id: 'org/model',
    format: 'transformers',
    summary: { total_parameters: 1000, trainable_parameters: 1000, non_trainable_parameters: 0, by_type: [] },
    root: { name: '', type: 'Model', parameters: 0, trainable: true, shape: null, children: [] },
    inspected_at: '2026-04-30T00:00:00.000Z',
  };
  return {
    DATA_DIR: '/tmp/arch-test-data',
    sanitizeModelId: vi.fn((raw: string) => {
      if (raw.includes('..') || raw.startsWith('.')) throw Object.assign(new Error('invalid'), { code: 'not_inspectable' });
      return raw.replace(/\//g, '--');
    }),
    readCachedTree: vi.fn(() => ({ code: 'not_cached' })),
    runInspection: vi.fn(async () => validTree),
    deleteCacheFiles: vi.fn(),
  };
});

const validTree = {
  schema_version: '1.0.0',
  model_id: 'org/model',
  format: 'transformers',
  summary: { total_parameters: 1000, trainable_parameters: 1000, non_trainable_parameters: 0, by_type: [] },
  root: { name: '', type: 'Model', parameters: 0, trainable: true, shape: null, children: [] },
  inspected_at: '2026-04-30T00:00:00.000Z',
};

const MODEL_ID_A = 'org/model';
const MODEL_ID_B = 'org/model-b';

function authHeader() {
  return { 'x-api-token': 'test-token' };
}

type SeedResult = { serverId: string; modelIdA: string; modelIdB: string };

async function seedData(app: FastifyInstance): Promise<SeedResult> {
  const serverResp = await app.inject({
    method: 'POST',
    url: '/inference-servers',
    headers: { ...authHeader(), 'content-type': 'application/json' },
    payload: {
      inference_server: { display_name: 'Test Server', active: true, archived: false },
      endpoints: { base_url: 'http://localhost:11434' },
      runtime: { api: { schema_family: ['openai-compatible'], api_version: null } },
    },
  });
  if (serverResp.statusCode !== 201) {
    throw new Error(`Failed to create test server: ${serverResp.statusCode} ${serverResp.body}`);
  }
  const { inference_server: { server_id: serverId } } = serverResp.json();

  const baseModel = {
    identity: { provider: 'meta' },
    architecture: { quantisation: { method: 'none', bits: null, group_size: null } },
    limits: {},
    capabilities: {
      generation: { text: true, json_schema_output: false, tools: false, embeddings: false },
      multimodal: { vision: false, audio: false },
      reasoning: { supported: false, explicit_tokens: false },
      use_case: { thinking: false, coding: false, instruct: false, mixture_of_experts: false },
    },
  };

  for (const modelId of [MODEL_ID_A, MODEL_ID_B]) {
    const resp = await app.inject({
      method: 'POST',
      url: '/models',
      headers: { ...authHeader(), 'content-type': 'application/json' },
      payload: { model: { model_id: modelId, server_id: serverId, display_name: modelId }, ...baseModel },
    });
    if (resp.statusCode !== 201) {
      throw new Error(`Failed to create model ${modelId}: ${resp.statusCode} ${resp.body}`);
    }
  }

  return { serverId, modelIdA: MODEL_ID_A, modelIdB: MODEL_ID_B };
}

describe('Architecture routes', () => {
  let app: FastifyInstance;
  let seed: SeedResult;
  let inspector: { readCachedTree: ReturnType<typeof vi.fn>; runInspection: ReturnType<typeof vi.fn>; deleteCacheFiles: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    process.env.AITESTBENCH_DB_PATH = ':memory:';
    vi.resetModules();
    const { createServer } = await import('../../src/api/server.js');
    app = createServer();
    await app.ready();
    const mod = await import('../../src/adapters/architecture-inspector.js');
    inspector = mod as unknown as typeof inspector;
    seed = await seedData(app);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  function archUrl(modelId: string, suffix = '') {
    return `/models/${seed.serverId}/${encodeURIComponent(modelId)}/architecture${suffix}`;
  }

  describe('POST /models/:serverId/:modelId/architecture', () => {
    it('returns 200 with cached tree on cache hit', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().schema_version).toBe('1.0.0');
    });

    it('returns 200 on cold inspection', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValueOnce({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(200);
    });

    it('returns 409 when inspection is already in progress', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce({ code: 'inspection_in_progress' });

      const response = await app.inject({
        method: 'POST',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().code).toBe('inspection_in_progress');
    });

    it('returns 503 when concurrency limit reached', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce({ code: 'concurrency_limit' });

      const response = await app.inject({
        method: 'POST',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().code).toBe('concurrency_limit');
    });

    it('returns 422 for non-inspectable model', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce({ code: 'not_inspectable' });

      const response = await app.inject({
        method: 'POST',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(422);
    });

    it('returns 404 for model not in DB', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/models/unknown-server/nonexistent-model/architecture',
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('model_not_found');
    });

    it('allows 2 concurrent POSTs for distinct modelIds without 503', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValue(validTree as any);

      const [r1, r2] = await Promise.all([
        app.inject({ method: 'POST', url: archUrl(seed.modelIdA), headers: authHeader() }),
        app.inject({ method: 'POST', url: archUrl(seed.modelIdB), headers: authHeader() }),
      ]);
      expect(r1.statusCode).not.toBe(503);
      expect(r2.statusCode).not.toBe(503);
    });
  });

  describe('GET /models/:serverId/:modelId/architecture', () => {
    it('returns 200 when cached', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValueOnce(validTree as any);

      const response = await app.inject({
        method: 'GET',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(200);
    });

    it('returns 404 with not_cached when not cached', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValueOnce({ code: 'not_cached' });

      const response = await app.inject({
        method: 'GET',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('not_cached');
    });
  });

  describe('DELETE /models/:serverId/:modelId/architecture', () => {
    it('returns 204', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(204);
    });
  });

  describe('GET /models/:serverId/:modelId/architecture/settings', () => {
    it('returns default trust_remote_code: false when no row exists', async () => {
      const response = await app.inject({
        method: 'GET',
        url: archUrl(seed.modelIdA, '/settings'),
        headers: authHeader(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().trust_remote_code).toBe(false);
    });
  });

  describe('PATCH /models/:serverId/:modelId/architecture/settings', () => {
    it('upserts and returns updated settings', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: archUrl(seed.modelIdA, '/settings'),
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { trust_remote_code: true },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().trust_remote_code).toBe(true);
    });

    it('returns 400 for invalid body', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: archUrl(seed.modelIdA, '/settings'),
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: { trust_remote_code: 'not-a-boolean' },
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
