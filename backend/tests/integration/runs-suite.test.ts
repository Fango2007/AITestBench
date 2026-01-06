import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';
import { createTargetRecord } from '../../src/services/target-service';
import { saveSuite } from '../../src/services/suite-service';


describe('suite runs API', () => {
  it('creates a suite run', async () => {
    const app = createServer();
    const target = createTargetRecord({
      name: `suite-target-${Date.now()}`,
      base_url: 'http://localhost:11434'
    });
    saveSuite({ id: 'suite-1', name: 'Suite 1' });

    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { target_id: target.id, suite_id: 'suite-1' }
    });

    expect(response.statusCode).toBe(201);
  });
});
