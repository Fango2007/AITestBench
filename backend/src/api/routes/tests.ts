import { FastifyInstance } from 'fastify';

import { fetchTests, reloadTests } from '../../services/test-service.js';

export function registerTestsRoutes(app: FastifyInstance): void {
  app.get('/tests', async () => fetchTests());

  app.post('/tests/reload', async () => {
    const result = reloadTests();
    return { reloaded: result.count, errors: result.errors };
  });
}
