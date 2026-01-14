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

describe('templates contract', () => {
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

  it('creates, updates, and deletes templates', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/templates',
      headers: AUTH_HEADERS,
      payload: {
        id: 'json-template',
        name: 'JSON Template',
        type: 'json',
        version: '1.0.0',
        content: buildJsonTemplateContent('json-template', 'JSON Template')
      }
    });
    expect(createResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/templates',
      headers: AUTH_HEADERS
    });
    expect(listResponse.statusCode).toBe(200);
    const templates = listResponse.json();
    expect(templates).toHaveLength(1);

    const updateResponse = await app.inject({
      method: 'PUT',
      url: '/templates/json-template',
      headers: AUTH_HEADERS,
      payload: {
        name: 'JSON Template Updated',
        type: 'json',
        version: '1.0.1',
        content: buildJsonTemplateContent('json-template', 'JSON Template Updated', '1.0.1')
      }
    });
    expect(updateResponse.statusCode).toBe(200);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: '/templates/json-template',
      headers: AUTH_HEADERS
    });
    expect(deleteResponse.statusCode).toBe(204);
  });

  it('rejects duplicate ids and names', async () => {
    const app = createServer();
    await app.inject({
      method: 'POST',
      url: '/templates',
      headers: AUTH_HEADERS,
      payload: {
        id: 'dup-template',
        name: 'Duplicate Name',
        type: 'json',
        version: '1.0.0',
        content: buildJsonTemplateContent('dup-template', 'Duplicate Name')
      }
    });

    const duplicateId = await app.inject({
      method: 'POST',
      url: '/templates',
      headers: AUTH_HEADERS,
      payload: {
        id: 'dup-template',
        name: 'Another Name',
        type: 'json',
        version: '1.0.0',
        content: buildJsonTemplateContent('dup-template', 'Another Name')
      }
    });
    expect(duplicateId.statusCode).toBe(409);

    const duplicateName = await app.inject({
      method: 'POST',
      url: '/templates',
      headers: AUTH_HEADERS,
      payload: {
        id: 'unique-template',
        name: 'Duplicate Name',
        type: 'json',
        version: '1.0.0',
        content: buildJsonTemplateContent('unique-template', 'Duplicate Name')
      }
    });
    expect(duplicateName.statusCode).toBe(409);
  });
});
