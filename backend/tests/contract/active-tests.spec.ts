import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb, resetDbInstance } from '../../src/models/db.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  try {
    db.prepare('DELETE FROM active_tests').run();
  } catch {
    // Table may not exist if schema bootstrap did not run before cleanup.
  }
}

function buildJsonTemplateContent(id: string, name: string, version = '1.0.0') {
  return JSON.stringify(
    {
      id,
      version,
      name,
      description: 'Template description',
      protocols: [],
      steps: [
        {
          id: 'step-1',
          request: {
            method: 'POST',
            url: '/v1/chat/completions',
            body_template: {}
          },
          assert: []
        }
      ],
      final_assert: []
    },
    null,
    2
  );
}

describe('active tests contract', () => {
  process.env.INFERHARNESS_API_TOKEN = 'test-token';

  let tempDir: string;
  let tempDbDir: string;

  beforeEach(() => {
    tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inferharness-active-tests-db-'));
    process.env.INFERHARNESS_DB_PATH = path.join(tempDbDir, 'inferharness.sqlite');
    resetDbInstance();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inferharness-templates-'));
    process.env.INFERHARNESS_TEST_TEMPLATES_DIR = tempDir;
  });

  afterEach(() => {
    resetDb();
    resetDbInstance();
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (tempDbDir && fs.existsSync(tempDbDir)) {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    }
  });

  it('instantiates and lists active tests', async () => {
    const app = createServer();
    const createTemplateResponse = await app.inject({
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
    expect(createTemplateResponse.statusCode).toBe(201);

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
    const createTemplateResponse = await app.inject({
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
    expect(createTemplateResponse.statusCode).toBe(201);
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
    expect(instantiateResponse.statusCode).toBe(201);
    const [activeTest] = instantiateResponse.json();

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/active-tests/${activeTest.id}`,
      headers: AUTH_HEADERS
    });
    expect(deleteResponse.statusCode).toBe(204);
  });
});
