import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';

describe('targets API', () => {
  it('lists targets', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/targets' });
    expect(response.statusCode).toBe(200);
  });
});
