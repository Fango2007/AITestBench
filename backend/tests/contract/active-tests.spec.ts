import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb } from '../../src/models/db.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  db.prepare('DELETE FROM active_tests').run();
}

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

describe('active tests contract', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';
  process.env.AITESTBENCH_DB_PATH = ':memory:';

  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitestbench-templates-'));
    process.env.AITESTBENCH_TEST_TEMPLATES_DIR = tempDir;
  });

  afterEach(() => {
    resetDb();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('instantiates and lists active tests', async () => {
    const app = createServer();
    await app.inject({
      method: 'POST',
      url: '/templates',
      headers: AUTH_HEADERS,
      payload: {
        id: 'template-1',
        name: 'Template 1',
        type: 'json',
        version: '1.0.0',
        content: buildJsonTemplateContent('template-1', 'Template 1')
      }
    });

    const instantiateResponse = await app.inject({
      method: 'POST',
      url: '/active-tests/instantiate',
      headers: AUTH_HEADERS,
      payload: {
        inference_server_id: 'server-1',
        model_name: 'gpt-4o-mini',
        template_ids: ['template-1']
      }
    });
    expect(instantiateResponse.statusCode).toBe(201);
    const activeTests = instantiateResponse.json();
    expect(activeTests).toHaveLength(1);
    expect(activeTests[0].template_version).toBe('1.0.0');
    expect(activeTests[0].command_preview).toMatch(/curl -X/);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/active-tests',
      headers: AUTH_HEADERS
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toHaveLength(1);
  });

  it('deletes active tests', async () => {
    const app = createServer();
    await app.inject({
      method: 'POST',
      url: '/templates',
      headers: AUTH_HEADERS,
      payload: {
        id: 'template-2',
        name: 'Template 2',
        type: 'json',
        version: '1.0.0',
        content: buildJsonTemplateContent('template-2', 'Template 2')
      }
    });
    const instantiateResponse = await app.inject({
      method: 'POST',
      url: '/active-tests/instantiate',
      headers: AUTH_HEADERS,
      payload: {
        inference_server_id: 'server-1',
        model_name: 'gpt-4o-mini',
        template_ids: ['template-2']
      }
    });
    const [activeTest] = instantiateResponse.json();

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/active-tests/${activeTest.id}`,
      headers: AUTH_HEADERS
    });
    expect(deleteResponse.statusCode).toBe(204);
  });
});
