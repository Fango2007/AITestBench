import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';

describe('tests reload API', () => {
  it('reloads tests', async () => {
    process.env.LLM_HARNESS_API_TOKEN = 'test-token';
    const app = createServer();
    const response = await app.inject({
      method: 'POST',
      url: '/tests/reload',
      headers: { 'x-api-token': 'test-token' }
    });
    expect(response.statusCode).toBe(200);
  });
});
