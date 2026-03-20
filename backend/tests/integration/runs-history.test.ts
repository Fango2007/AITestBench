import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { runSchema } from '../../src/models/db.js';


describe('run history API', () => {
  it('lists runs', async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    process.env.AITESTBENCH_DB_PATH = ':memory:';
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const schemaPath = path.resolve(moduleDir, '../../src/models/schema.sql');
    runSchema(fs.readFileSync(schemaPath, 'utf8'));
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/runs',
      headers: { 'x-api-token': 'test-token' }
    });
    if (response.statusCode !== 200) {
      throw new Error(`list runs failed: ${response.statusCode} ${response.body}`);
    }
    expect(response.statusCode).toBe(200);
  });
});
