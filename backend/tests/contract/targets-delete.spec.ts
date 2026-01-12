import { afterEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { getDb } from '../../src/models/db.js';

const AUTH_HEADERS = { 'x-api-token': 'test-token' };

function resetDb() {
  const db = getDb();
  db.prepare('DELETE FROM runs').run();
  db.prepare('DELETE FROM targets').run();
}

async function createTarget(app: ReturnType<typeof createServer>) {
  const response = await app.inject({
    method: 'POST',
    url: '/targets',
    headers: AUTH_HEADERS,
    payload: { name: 'Deletable', base_url: 'http://localhost:11434' }
  });
  return response.json() as { id: string };
}

describe('targets delete contract', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';
  process.env.AITESTBENCH_DB_PATH = ':memory:';

  afterEach(() => {
    resetDb();
  });

  it('deletes targets without runs', async () => {
    const app = createServer();
    const target = await createTarget(app);
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/targets/${target.id}`,
      headers: AUTH_HEADERS
    });
    expect(deleteResponse.statusCode).toBe(204);
  });
});
