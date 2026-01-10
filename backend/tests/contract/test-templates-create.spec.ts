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

describe('test templates contract', () => {
  it('creates and lists templates', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/test-templates',
      headers: AUTH_HEADERS,
      payload: {
        name: 'Smoke Template',
        format: 'json',
        content: '{"hello":"world"}'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json() as { id: string; name: string; current_version_number: number };
    expect(created.name).toBe('Smoke Template');
    expect(created.current_version_number).toBe(1);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/test-templates',
      headers: AUTH_HEADERS
    });

    expect(listResponse.statusCode).toBe(200);
    const templates = listResponse.json() as Array<{ id: string; name: string }>;
    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe(created.id);

    const db = getDb();
    const row = db
      .prepare('SELECT storage_path FROM test_templates WHERE id = ?')
      .get(created.id) as { storage_path: string } | undefined;
    expect(row?.storage_path).toBeTruthy();
    expect(fs.existsSync(row!.storage_path)).toBe(true);
  });
});
