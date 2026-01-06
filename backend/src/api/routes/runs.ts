import { FastifyInstance } from 'fastify';

import { getDb } from '../../models/db';
import { createSingleRun, getRun, listRunResults } from '../../services/run-service';

export function registerRunsRoutes(app: FastifyInstance): void {
  app.post('/runs', async (request, reply) => {
    const payload = request.body as {
      target_id: string;
      test_id?: string;
      suite_id?: string;
      profile_id?: string;
      profile_version?: string;
    };
    const run = createSingleRun(payload);
    reply.code(201).send(run);
  });

  app.get('/runs', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM runs ORDER BY started_at DESC').all();
  });

  app.get('/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = getRun(runId);
    if (!run) {
      reply.code(404).send({ error: 'Run not found' });
      return;
    }
    reply.send(run);
  });

  app.get('/runs/:runId/results', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const results = listRunResults(runId);
    reply.send(results);
  });
}
