import { afterEach, describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';
import { getDb } from '../../src/models/db';

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
    payload: { name: 'Editable', base_url: 'http://localhost:11434' }
  });
  return response.json() as { id: string };
}

describe('targets update contract', () => {
  process.env.AITESTBENCH_API_TOKEN = 'test-token';
  process.env.AITESTBENCH_DB_PATH = ':memory:';

  afterEach(() => {
    resetDb();
  });

  it('updates targets', async () => {
    const app = createServer();
    const target = await createTarget(app);
    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/targets/${target.id}`,
      headers: AUTH_HEADERS,
      payload: { name: 'Renamed', base_url: 'http://localhost:11435' }
    });
    expect(updateResponse.statusCode).toBe(200);
  });

  it('archives targets', async () => {
    const app = createServer();
    const target = await createTarget(app);
    const archiveResponse = await app.inject({
      method: 'POST',
      url: `/targets/${target.id}/archive`,
      headers: AUTH_HEADERS
    });
    expect(archiveResponse.statusCode).toBe(200);
    const payload = archiveResponse.json() as { status?: string };
    expect(payload.status).toBe('archived');
  });
});
