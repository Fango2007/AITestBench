import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../../src/adapters/architecture-inspector.js', () => {
  const validTree = {
    schema_version: '1.0.0',
    model_id: 'org/model',
    format: 'transformers',
    inspection_method: 'transformers_exact',
    accuracy: 'exact',
    warnings: [],
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
  inspection_method: 'transformers_exact',
  accuracy: 'exact',
  warnings: [],
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

async function createModel(
  app: FastifyInstance,
  serverId: string,
  modelId: string,
  overrides: Record<string, unknown> = {}
): Promise<void> {
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
    ...overrides,
  };

  const resp = await app.inject({
    method: 'POST',
    url: '/models',
    headers: { ...authHeader(), 'content-type': 'application/json' },
    payload: {
      model: { model_id: modelId, server_id: serverId, display_name: modelId },
      ...baseModel,
    },
  });
  if (resp.statusCode !== 201) {
    throw new Error(`Failed to create model ${modelId}: ${resp.statusCode} ${resp.body}`);
  }
}

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

  for (const modelId of [MODEL_ID_A, MODEL_ID_B]) {
    await createModel(app, serverId, modelId);
  }

  return { serverId, modelIdA: MODEL_ID_A, modelIdB: MODEL_ID_B };
}

describe('Architecture routes', () => {
  let app: FastifyInstance;
  let seed: SeedResult;
  let inspector: { readCachedTree: ReturnType<typeof vi.fn>; runInspection: ReturnType<typeof vi.fn>; deleteCacheFiles: ReturnType<typeof vi.fn> };
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-route-test-'));
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
    fs.rmSync(tmpRoot, { recursive: true, force: true });
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

    it('returns a visible fallback message for inspection failures with empty diagnostics', async () => {
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce({ code: 'inspection_failed', message: '' });

      const response = await app.inject({
        method: 'POST',
        url: archUrl(seed.modelIdA),
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ code: 'inspection_failed', error: 'Inspection failed.' });
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

    it('inspects a local GGUF model when a local model path is available', async () => {
      const ggufPath = path.join(tmpRoot, 'model.gguf');
      fs.writeFileSync(ggufPath, 'GGUF', 'utf8');
      await createModel(app, seed.serverId, 'local-gguf-model', {
        architecture: { format: 'GGUF', quantisation: { method: 'gguf', bits: 4, group_size: null } },
        raw: { model_path: ggufPath },
      });
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl('local-gguf-model'),
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      expect(inspector.runInspection).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'gguf', modelPath: ggufPath })
      );
    });

    it('inspects a local MLX model directory when a config.json is available', async () => {
      const mlxPath = path.join(tmpRoot, 'mlx-model');
      fs.mkdirSync(mlxPath);
      fs.writeFileSync(path.join(mlxPath, 'config.json'), '{}', 'utf8');
      await createModel(app, seed.serverId, 'local-mlx-model', {
        architecture: { format: 'MLX', quantisation: { method: 'mlx', bits: 6, group_size: null } },
        raw: { model_path: mlxPath },
      });
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl('local-mlx-model'),
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      expect(inspector.runInspection).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'mlx', modelPath: mlxPath })
      );
    });

    it('inspects an HF-style MLX model through the MLX transformer-config strategy', async () => {
      await createModel(app, seed.serverId, 'mlx-community/model-4bit', {
        architecture: { format: 'MLX', quantisation: { method: 'mlx', bits: 4, group_size: null } },
      });
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl('mlx-community/model-4bit'),
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      expect(inspector.runInspection).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'mlx', modelPath: undefined })
      );
    });

    it('inspects a local-server MLX model ID with a leading slash through the HF config strategy', async () => {
      await createModel(app, seed.serverId, '/mlx-community/model-4bit', {
        architecture: { format: 'MLX', quantisation: { method: 'mlx', bits: 4, group_size: null } },
      });
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl('/mlx-community/model-4bit'),
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      expect(inspector.runInspection).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: '/mlx-community/model-4bit',
          sourceModelId: 'mlx-community/model-4bit',
          format: 'mlx',
          modelPath: undefined,
        })
      );
    });

    it('routes GPTQ and AWQ models through config-backed inspection strategies', async () => {
      await createModel(app, seed.serverId, 'TheBloke/model-GPTQ', {
        architecture: { format: 'GPTQ', quantisation: { method: 'gptq', bits: 4, group_size: null } },
      });
      await createModel(app, seed.serverId, 'TheBloke/model-AWQ', {
        architecture: { format: 'AWQ', quantisation: { method: 'awq', bits: 4, group_size: null } },
      });
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValue(validTree as any);

      const [gptqResponse, awqResponse] = await Promise.all([
        app.inject({ method: 'POST', url: archUrl('TheBloke/model-GPTQ'), headers: authHeader() }),
        app.inject({ method: 'POST', url: archUrl('TheBloke/model-AWQ'), headers: authHeader() }),
      ]);

      expect(gptqResponse.statusCode).toBe(200);
      expect(awqResponse.statusCode).toBe(200);
      expect(inspector.runInspection).toHaveBeenCalledWith(expect.objectContaining({ format: 'gptq' }));
      expect(inspector.runInspection).toHaveBeenCalledWith(expect.objectContaining({ format: 'awq' }));
    });

    it('inspects local SafeTensors files through the SafeTensors header strategy', async () => {
      const modelDir = path.join(tmpRoot, 'safetensors-model');
      fs.mkdirSync(modelDir);
      fs.writeFileSync(path.join(modelDir, 'model.safetensors'), 'stub', 'utf8');
      await createModel(app, seed.serverId, 'local-safetensors-model', {
        architecture: { format: 'SafeTensors', quantisation: { method: 'none', bits: null, group_size: null } },
        raw: { model_path: modelDir },
      });
      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl('local-safetensors-model'),
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      expect(inspector.runInspection).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'safetensors', modelPath: modelDir })
      );
    });

    it('registers and inspects a discovered-only local-server MLX model on first inspection', async () => {
      const modelId = '/lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit';
      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/inference-servers/${seed.serverId}`,
        headers: { ...authHeader(), 'content-type': 'application/json' },
        payload: {
          discovery: {
            model_list: {
              raw: {},
              normalised: [
                {
                  model_id: modelId,
                  display_name: modelId,
                  context_window_tokens: 32768,
                  quantisation: { method: 'mlx', bits: 6, group_size: null },
                },
              ],
            },
          },
        },
      });
      expect(patchResponse.statusCode).toBe(200);

      vi.mocked(inspector.readCachedTree).mockReturnValue({ code: 'not_cached' });
      vi.mocked(inspector.runInspection).mockResolvedValueOnce(validTree as any);

      const response = await app.inject({
        method: 'POST',
        url: archUrl(modelId),
        headers: authHeader(),
      });

      expect(response.statusCode).toBe(200);
      expect(inspector.runInspection).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId,
          sourceModelId: 'lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit',
          format: 'mlx',
        })
      );
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
