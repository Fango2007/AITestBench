import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';

describe('targets API', () => {
  it('lists targets', async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/targets',
      headers: { 'x-api-token': 'test-token' }
    });
    expect(response.statusCode).toBe(200);
  });
});
