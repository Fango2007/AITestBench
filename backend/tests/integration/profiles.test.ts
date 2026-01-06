import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';


describe('profiles API', () => {
  it('lists profiles', async () => {
    const app = createServer();
    const response = await app.inject({ method: 'GET', url: '/profiles' });
    expect(response.statusCode).toBe(200);
  });
});
