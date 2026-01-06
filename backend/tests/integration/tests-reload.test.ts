import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';

describe('tests reload API', () => {
  it('reloads tests', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'POST', url: '/tests/reload' });
    expect(response.statusCode).toBe(200);
  });
});
