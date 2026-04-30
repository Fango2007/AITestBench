import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb } from '../../src/models/db.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  try {
    db.prepare('DELETE FROM models').run();
  } catch {
    // Table may not exist before schema bootstrap in first test.
  }
  try {
    db.prepare('DELETE FROM inference_servers').run();
  } catch {
    // Table may not exist before schema bootstrap in first test.
  }
}

function buildServerPayload(overrides?: Record<string, unknown>) {
  return {
    inference_server: { display_name: 'Local Inference', active: true, archived: false },
    endpoints: { base_url: 'http://localhost:11434' },
    runtime: { api: { schema_family: ['openai-compatible'], api_version: null } },
    ...(overrides ?? {})
  };
}

function buildModelPayload(serverId: string, overrides?: Record<string, unknown>) {
  return {
    model: {
      server_id: serverId,
      model_id: 'gpt-test',
      display_name: 'GPT Test',
      active: true,
      archived: false
    },
    identity: {
      provider: 'openai',
      family: null,
      version: null,
      revision: null,
      checksum: null
    },
    ...(overrides ?? {})
  };
}

describe('models contract', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';
  process.env.AITESTBENCH_DB_PATH = ':memory:';

  createServer();

  afterEach(() => {
    resetDb();
    vi.restoreAllMocks();
  });

  it('creates and lists models', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id)
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.model.model_id).toBe('gpt-test');
    expect(created.model.created_at).toBeTruthy();
    expect(created.model.updated_at).toBeTruthy();

    const listResponse = await app.inject({
      method: 'GET',
      url: '/models',
      headers: AUTH_HEADERS
    });
    expect(listResponse.statusCode).toBe(200);
    const models = listResponse.json();
    expect(models).toHaveLength(1);
  });

  it('validates enums and rejects invalid values', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id, {
        identity: { provider: 'invalid' }
      })
    });
    expect(response.statusCode).toBe(400);
  });

  it('updates updated_at on changes', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id)
    });
    const created = createResponse.json();
    await new Promise((resolve) => setTimeout(resolve, 2));

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/models/${server.inference_server.server_id}/${created.model.model_id}`,
      headers: AUTH_HEADERS,
      payload: { model: { display_name: 'Updated Model' } }
    });
    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json();
    expect(updated.model.updated_at).not.toBe(created.model.updated_at);
  });

  // v1.1.0 schema enrichment tests (T002)

  it('auto-infers base_model_name from model_id path on POST /models', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id, {
        model: {
          server_id: server.inference_server.server_id,
          model_id: '/lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit',
          display_name: 'Qwen3 Coder',
          active: true,
          archived: false
        }
      })
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.model.base_model_name).toBe('Qwen3-Coder-30B-A3B-Instruct');
  });

  it('accepts valid format enum value on POST /models and returns it', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id, {
        architecture: { format: 'GGUF' }
      })
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.architecture.format).toBe('GGUF');
  });

  it('rejects invalid format enum on POST /models with 400', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const response = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id, {
        architecture: { format: 'INVALID_FORMAT' }
      })
    });
    expect(response.statusCode).toBe(400);
  });

  it('accepts fractional quantisation.bits (6.5) on POST /models', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id, {
        architecture: { quantisation: { method: 'mlx', bits: 6.5, group_size: null } }
      })
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.architecture.quantisation.bits).toBe(6.5);
  });

  it('saves quantized_provider via PATCH and returns it', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id)
    });
    const created = createResponse.json();

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/models/${server.inference_server.server_id}/${created.model.model_id}`,
      headers: AUTH_HEADERS,
      payload: { identity: { quantized_provider: 'lmstudio-community' } }
    });
    expect(patchResponse.statusCode).toBe(200);
    const updated = patchResponse.json();
    expect(updated.identity.quantized_provider).toBe('lmstudio-community');
  });

  it('deep-merges use_case on PATCH without clobbering existing tags', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id, {
        capabilities: { use_case: { thinking: true, coding: false, instruct: false, mixture_of_experts: false } }
      })
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();

    const patchResponse = await app.inject({
      method: 'PATCH',
      url: `/models/${server.inference_server.server_id}/${created.model.model_id}`,
      headers: AUTH_HEADERS,
      payload: { capabilities: { use_case: { coding: true } } }
    });
    expect(patchResponse.statusCode).toBe(200);
    const updated = patchResponse.json();
    expect(updated.capabilities.use_case.thinking).toBe(true);
    expect(updated.capabilities.use_case.coding).toBe(true);
  });

  it('backward compat: records with null new fields return valid response with defaults', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id)
    });
    expect(createResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/models',
      headers: AUTH_HEADERS
    });
    expect(listResponse.statusCode).toBe(200);
    const models = listResponse.json();
    expect(models).toHaveLength(1);
    const record = models[0];
    // base_model_name is auto-inferred from model_id; for 'gpt-test' (no strippable tokens) it echoes the id
    expect(record.model).toHaveProperty('base_model_name');
    expect(record.identity.quantized_provider).toBeNull();
    expect(record.architecture.format).toBeNull();
    expect(record.capabilities.use_case).toEqual({
      thinking: false,
      coding: false,
      instruct: false,
      mixture_of_experts: false
    });
  });

  it('GET /models includes all v1.1.0 fields on each record', async () => {
    const app = createServer();
    const serverResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildServerPayload()
    });
    if (serverResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${serverResponse.statusCode} ${serverResponse.body}`);
    }
    const server = serverResponse.json();

    await app.inject({
      method: 'POST',
      url: '/models',
      headers: AUTH_HEADERS,
      payload: buildModelPayload(server.inference_server.server_id, {
        architecture: { format: 'MLX' },
        capabilities: { use_case: { thinking: true, coding: true, instruct: false, mixture_of_experts: false } },
        identity: { quantized_provider: 'lmstudio-community' }
      })
    });

    const listResponse = await app.inject({
      method: 'GET',
      url: '/models',
      headers: AUTH_HEADERS
    });
    expect(listResponse.statusCode).toBe(200);
    const [record] = listResponse.json();
    expect(record.architecture).toHaveProperty('format');
    expect(record.architecture.format).toBe('MLX');
    expect(record.identity).toHaveProperty('quantized_provider');
    expect(record.identity.quantized_provider).toBe('lmstudio-community');
    expect(record.capabilities).toHaveProperty('use_case');
    expect(record.capabilities.use_case.thinking).toBe(true);
    expect(record.capabilities.use_case.coding).toBe(true);
    expect(record.model).toHaveProperty('base_model_name');
  });
});
