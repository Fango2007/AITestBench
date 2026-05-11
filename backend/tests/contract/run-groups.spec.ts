import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { resetDbInstance } from '../../src/models/db.js';
import { createInferenceServerRecord } from '../../src/services/inference-servers-repository.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function buildJsonTemplateContent(id: string, name: string, version = '1.0.0') {
  return JSON.stringify(
    {
      id,
      version,
      name,
      description: 'Template description',
      protocols: [],
      request: { method: 'POST', path: '/v1/chat/completions', body_template: {} },
      assertions: [],
      metrics: {}
    },
    null,
    2
  );
}

async function createTemplate(app: ReturnType<typeof createServer>, id: string) {
  const response = await app.inject({
    method: 'POST',
    url: '/templates',
    headers: AUTH_HEADERS,
    payload: {
      id,
      name: id,
      type: 'json',
      version: '1.0.0',
      content: buildJsonTemplateContent(id, id)
    }
  });
  expect(response.statusCode).toBe(201);
}

async function waitForGroup(app: ReturnType<typeof createServer>, id: string) {
  for (let index = 0; index < 20; index += 1) {
    const response = await app.inject({
      method: 'GET',
      url: `/run-groups/${id}`,
      headers: AUTH_HEADERS
    });
    expect(response.statusCode).toBe(200);
    const group = response.json();
    if (group.status !== 'running' && group.status !== 'queued') {
      return group;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Run group ${id} did not finish.`);
}

describe('run groups API', () => {
  process.env.INFERHARNESS_API_TOKEN = 'test-token';

  let tempDir: string;
  let tempDbDir: string;
  let app: ReturnType<typeof createServer>;

  beforeEach(() => {
    tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inferharness-run-groups-db-'));
    process.env.INFERHARNESS_DB_PATH = path.join(tempDbDir, 'inferharness.sqlite');
    resetDbInstance();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inferharness-run-groups-templates-'));
    process.env.INFERHARNESS_TEST_TEMPLATES_DIR = tempDir;
    app = createServer();
  });

  afterEach(async () => {
    await app.close();
    resetDbInstance();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (tempDbDir && fs.existsSync(tempDbDir)) {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    }
  });

  it('validates target count and uniqueness', async () => {
    await createTemplate(app, 'rg-template-validation');
    const server = createInferenceServerRecord({
      inference_server: { display_name: 'Run group validation' },
      endpoints: { base_url: 'http://localhost:11434' },
      runtime: { api: { schema_family: ['openai-compatible'], api_version: null } }
    });

    const empty = await app.inject({
      method: 'POST',
      url: '/run-groups',
      headers: AUTH_HEADERS,
      payload: { targets: [], selected_template_ids: ['rg-template-validation'] }
    });
    expect(empty.statusCode).toBe(400);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/run-groups',
      headers: AUTH_HEADERS,
      payload: {
        targets: [
          { inference_server_id: server.inference_server.server_id, model_id: 'model-a' },
          { inference_server_id: server.inference_server.server_id, model_id: 'model-a' }
        ],
        selected_template_ids: ['rg-template-validation']
      }
    });
    expect(duplicate.statusCode).toBe(400);

    const tooMany = await app.inject({
      method: 'POST',
      url: '/run-groups',
      headers: AUTH_HEADERS,
      payload: {
        targets: Array.from({ length: 9 }, (_entry, index) => ({
          inference_server_id: server.inference_server.server_id,
          model_id: `model-${index}`
        })),
        selected_template_ids: ['rg-template-validation']
      }
    });
    expect(tooMany.statusCode).toBe(400);

    const missingTemplate = await app.inject({
      method: 'POST',
      url: '/run-groups',
      headers: AUTH_HEADERS,
      payload: {
        targets: [{ inference_server_id: server.inference_server.server_id, model_id: 'model-a' }],
        selected_template_ids: ['missing-template']
      }
    });
    expect(missingTemplate.statusCode).toBe(400);
  });

  it('creates child runs for multiple targets', async () => {
    await createTemplate(app, 'rg-template-multi');
    const server = createInferenceServerRecord({
      inference_server: { display_name: 'Run group multi' },
      endpoints: { base_url: 'http://localhost:11434' },
      runtime: { api: { schema_family: ['openai-compatible'], api_version: null } }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/run-groups',
      headers: AUTH_HEADERS,
      payload: {
        targets: [
          { inference_server_id: server.inference_server.server_id, model_id: 'model-a' },
          { inference_server_id: server.inference_server.server_id, model_id: 'model-b' }
        ],
        selected_template_ids: ['rg-template-multi'],
        test_overrides: { request_timeout_sec: 5 }
      }
    });
    expect(response.statusCode).toBe(201);
    const created = response.json();
    expect(created.items).toHaveLength(2);
    expect(created.items.map((item: { stable_letter: string }) => item.stable_letter)).toEqual(['A', 'B']);

    const completed = await waitForGroup(app, created.id);
    expect(completed.status).toBe('completed');
    expect(completed.items).toHaveLength(2);
    expect(completed.items.every((item: { child_run_id?: string; run?: unknown }) => item.child_run_id && item.run)).toBe(true);
  });

  it('cancels a group and forwards cancellation to child runs', async () => {
    await createTemplate(app, 'rg-template-cancel');
    const server = createInferenceServerRecord({
      inference_server: { display_name: 'Run group cancel' },
      endpoints: { base_url: 'http://localhost:11434' },
      runtime: { api: { schema_family: ['openai-compatible'], api_version: null } }
    });
    const response = await app.inject({
      method: 'POST',
      url: '/run-groups',
      headers: AUTH_HEADERS,
      payload: {
        targets: [{ inference_server_id: server.inference_server.server_id, model_id: 'model-a' }],
        selected_template_ids: ['rg-template-cancel']
      }
    });
    expect(response.statusCode).toBe(201);
    const groupId = response.json().id;

    const canceled = await app.inject({
      method: 'POST',
      url: `/run-groups/${groupId}/cancel`,
      headers: AUTH_HEADERS,
      payload: {}
    });
    expect(canceled.statusCode).toBe(200);
    expect(canceled.json().status).toBe('canceled');
    expect(canceled.json().items[0].status).toBe('canceled');
  });
});
