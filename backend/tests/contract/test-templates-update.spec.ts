import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';
import { getDb } from '../../src/models/db';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

let templateDir = '';

function resetDb() {
  const db = getDb();
  db.prepare('DELETE FROM instantiated_tests').run();
  db.prepare('DELETE FROM test_template_versions').run();
  db.prepare('DELETE FROM test_templates').run();
}

beforeEach(() => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';
  process.env.AITESTBENCH_DB_PATH = ':memory:';
  templateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aitb-templates-'));
  process.env.AITESTBENCH_TEST_TEMPLATE_DIR = templateDir;
});

afterEach(() => {
  resetDb();
  if (templateDir) {
    fs.rmSync(templateDir, { recursive: true, force: true });
  }
});

describe('test templates versioning contract', () => {
  it('creates new versions on update', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/test-templates',
      headers: AUTH_HEADERS,
      payload: {
        name: 'Versioned Template',
        format: 'json',
        content: '{"step":1}'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as { id: string };

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/test-templates/${created.id}`,
      headers: AUTH_HEADERS,
      payload: { content: '{"step":2}' }
    });

    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json() as { current_version_number: number };
    expect(updated.current_version_number).toBe(2);

    const detailResponse = await app.inject({
      method: 'GET',
      url: `/test-templates/${created.id}`,
      headers: AUTH_HEADERS
    });

    expect(detailResponse.statusCode).toBe(200);
    const detail = detailResponse.json() as { versions: Array<{ version_number: number }> };
    expect(detail.versions).toHaveLength(2);
    expect(detail.versions[0].version_number).toBe(2);

    const versionsResponse = await app.inject({
      method: 'GET',
      url: `/test-templates/${created.id}/versions`,
      headers: AUTH_HEADERS
    });

    expect(versionsResponse.statusCode).toBe(200);
    const versions = versionsResponse.json() as Array<{ version_number: number }>;
    expect(versions).toHaveLength(2);
  });
});
