import { FastifyInstance } from 'fastify';

import { fetchSuites, saveSuite } from '../../services/suite-service';

export function registerSuitesRoutes(app: FastifyInstance): void {
  app.get('/suites', async () => fetchSuites());

  app.post('/suites', async (request, reply) => {
    const suite = saveSuite(request.body as Record<string, unknown>);
    reply.code(201).send(suite);
  });
}
