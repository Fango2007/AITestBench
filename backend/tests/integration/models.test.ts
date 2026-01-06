import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';


describe('models API', () => {
  it('lists models', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/models' });
    expect(response.statusCode).toBe(200);
  });
});
