import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb } from '../../src/models/db.js';
import { isDiscoveryCacheValid } from '../../src/services/inference-servers-repository.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  try {
    db.prepare('DELETE FROM runs').run();
  } catch {
    // Table may not exist before schema bootstrap in first test.
  }
  try {
    db.prepare('DELETE FROM inference_servers').run();
  } catch {
    // Table may not exist before schema bootstrap in first test.
  }
}

function buildCreatePayload(overrides?: Record<string, unknown>) {
  return {
    inference_server: { display_name: 'Local Inference', active: true, archived: false },
    endpoints: { base_url: 'http://localhost:11434' },
    runtime: { api: { schema_family: ['openai-compatible'], api_version: null } },
    ...(overrides ?? {})
  };
}

describe('inference servers contract', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';
  process.env.AITESTBENCH_DB_PATH = ':memory:';

  createServer();

  afterEach(() => {
    resetDb();
    vi.restoreAllMocks();
  });

  it('creates and lists inference servers', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildCreatePayload()
    });
    if (createResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${createResponse.statusCode} ${createResponse.body}`);
    }
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created.inference_server.server_id).toBeTruthy();
    expect(created.inference_server.created_at).toBeTruthy();
    expect(created.inference_server.updated_at).toBeTruthy();

    const listResponse = await app.inject({
      method: 'GET',
      url: '/inference-servers',
      headers: AUTH_HEADERS
    });
    expect(listResponse.statusCode).toBe(200);
    const servers = listResponse.json();
    expect(servers).toHaveLength(1);
  });

  it('validates enums and rejects invalid values', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildCreatePayload({
        runtime: { api: { schema_family: ['invalid'], api_version: null } }
      })
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects active and archived both true', async () => {
    const app = createServer();
    const response = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildCreatePayload({
        inference_server: { display_name: 'Bad', active: true, archived: true }
      })
    });
    expect(response.statusCode).toBe(400);
  });

  it('updates updated_at on changes', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildCreatePayload()
    });
    if (createResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${createResponse.statusCode} ${createResponse.body}`);
    }
    const created = createResponse.json();
    await new Promise((resolve) => setTimeout(resolve, 2));
    const updatedResponse = await app.inject({
      method: 'PATCH',
      url: `/inference-servers/${created.inference_server.server_id}`,
      headers: AUTH_HEADERS,
      payload: { inference_server: { display_name: 'Updated Name' } }
    });
    expect(updatedResponse.statusCode).toBe(200);
    const updated = updatedResponse.json();
    expect(updated.inference_server.updated_at).not.toBe(created.inference_server.updated_at);
  });

  it('evaluates discovery TTL', () => {
    const now = new Date('2025-01-01T00:00:00.000Z').getTime();
    const valid = isDiscoveryCacheValid(
      {
        retrieved_at: '2025-01-01T00:00:00.000Z',
        ttl_seconds: 300,
        model_list: { raw: {}, normalised: [] }
      },
      now + 200 * 1000
    );
    const expired = isDiscoveryCacheValid(
      {
        retrieved_at: '2025-01-01T00:00:00.000Z',
        ttl_seconds: 300,
        model_list: { raw: {}, normalised: [] }
      },
      now + 400 * 1000
    );
    expect(valid).toBe(true);
    expect(expired).toBe(false);
  });

  it('refreshes discovery and stores raw + normalised payload', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildCreatePayload()
    });
    if (createResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${createResponse.statusCode} ${createResponse.body}`);
    }
    const created = createResponse.json();
    const payload = { data: [{ id: 'gpt-test' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => payload
          }) as any
      )
    );

    const refreshResponse = await app.inject({
      method: 'POST',
      url: `/inference-servers/${created.inference_server.server_id}/refresh-discovery`,
      headers: AUTH_HEADERS
    });
    expect(refreshResponse.statusCode).toBe(200);
    const refreshed = refreshResponse.json();
    expect(refreshed.discovery.model_list.raw).toEqual(payload);
    expect(refreshed.discovery.model_list.normalised[0].model_id).toBe('gpt-test');
  });

  it('filters malformed remote-prefixed OpenAI discovery model IDs', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildCreatePayload()
    });
    if (createResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${createResponse.statusCode} ${createResponse.body}`);
    }
    const created = createResponse.json();
    const payload = {
      object: 'list',
      data: [
        { id: '/inferencerlabs/Devstral-Small-2-24B-Instruct-2512-MLX-6.5bit', object: 'model' },
        { id: '<remote>/inferencerlabs/Devstral-Small-2-24B-Instruct-2512-MLX-6.5bit', object: 'model' }
      ]
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => payload
          }) as any
      )
    );

    const refreshResponse = await app.inject({
      method: 'POST',
      url: `/inference-servers/${created.inference_server.server_id}/refresh-discovery`,
      headers: AUTH_HEADERS
    });
    expect(refreshResponse.statusCode).toBe(200);
    const refreshed = refreshResponse.json();
    expect(refreshed.discovery.model_list.raw).toEqual(payload);
    expect(refreshed.discovery.model_list.normalised.map((model: { model_id: string }) => model.model_id)).toEqual([
      '/inferencerlabs/Devstral-Small-2-24B-Instruct-2512-MLX-6.5bit'
    ]);
  });

  it('does not wipe discovery on refresh failure', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/inference-servers',
      headers: AUTH_HEADERS,
      payload: buildCreatePayload({
        discovery: {
          retrieved_at: new Date().toISOString(),
          ttl_seconds: 300,
          model_list: { raw: { cached: true }, normalised: [{ model_id: 'cached', display_name: null, context_window_tokens: null, quantisation: null }] }
        }
      })
    });
    if (createResponse.statusCode !== 201) {
      throw new Error(`create inference server failed: ${createResponse.statusCode} ${createResponse.body}`);
    }
    const created = createResponse.json();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })) as any);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: `/inference-servers/${created.inference_server.server_id}/refresh-discovery`,
      headers: AUTH_HEADERS
    });
    expect(refreshResponse.statusCode).toBe(502);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/inference-servers/${created.inference_server.server_id}`,
      headers: AUTH_HEADERS
    });
    const fetched = getResponse.json();
    expect(fetched.discovery.model_list.raw).toEqual({ cached: true });
  });
});
