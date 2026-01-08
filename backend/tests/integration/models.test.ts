import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';


describe('models API', () => {
  it('lists models', async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/models',
      headers: { 'x-api-token': 'test-token' }
    });
    expect(response.statusCode).toBe(200);
  });
});
