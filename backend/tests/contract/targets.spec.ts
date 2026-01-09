import { afterEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';
import { getDb } from '../../src/models/db';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  db.prepare('DELETE FROM runs').run();
  db.prepare('DELETE FROM targets').run();
}

describe('targets contract', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';
  process.env.AITESTBENCH_DB_PATH = ':memory:';

  afterEach(() => {
    resetDb();
  });

  it('creates and lists targets', async () => {
    const app = createServer();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/targets',
      headers: AUTH_HEADERS,
      payload: { name: 'Local Ollama', base_url: 'http://localhost:11434' }
    });
    expect(createResponse.statusCode).toBe(201);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/targets',
      headers: AUTH_HEADERS
    });
    expect(listResponse.statusCode).toBe(200);
    const targets = listResponse.json();
    expect(targets).toHaveLength(1);
  });

  it('rejects duplicate names', async () => {
    const app = createServer();
    await app.inject({
      method: 'POST',
      url: '/targets',
      headers: AUTH_HEADERS,
      payload: { name: 'Duplicate', base_url: 'http://localhost:11434' }
    });

    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/targets',
      headers: AUTH_HEADERS,
      payload: { name: 'Duplicate', base_url: 'http://localhost:11435' }
    });
    expect(duplicateResponse.statusCode).toBe(409);
  });
});
