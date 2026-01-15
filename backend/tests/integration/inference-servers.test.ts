import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';

describe('inference servers API', () => {
  it('lists inference servers', async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/inference-servers',
      headers: { 'x-api-token': 'test-token' }
    });
    expect(response.statusCode).toBe(200);
  });
});
