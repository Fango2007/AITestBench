import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';


describe('profiles API', () => {
  it('lists profiles', async () => {
    process.env.LLM_HARNESS_API_TOKEN = 'test-token';
    const app = createServer();
    const response = await app.inject({
      method: 'GET',
      url: '/profiles',
      headers: { 'x-api-token': 'test-token' }
    });
    expect(response.statusCode).toBe(200);
  });
});
