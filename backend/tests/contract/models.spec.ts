import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb } from '../../src/models/db.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  db.prepare('DELETE FROM models').run();
  db.prepare('DELETE FROM inference_servers').run();
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
});
