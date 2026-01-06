import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';


describe('run history API', () => {
  it('lists runs', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/runs' });
    expect(response.statusCode).toBe(200);
  });
});
