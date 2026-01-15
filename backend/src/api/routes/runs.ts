import { FastifyInstance } from 'fastify';

import { getDb } from '../../models/db.js';
import { createSingleRun, getRun, listRunResults } from '../../services/run-service.js';

export function registerRunsRoutes(app: FastifyInstance): void {
  app.post('/runs', async (request, reply) => {
    const payload = request.body as {
      inference_server_id: string;
      test_id?: string;
      suite_id?: string;
      profile_id?: string;
      profile_version?: string;
      model?: string;
      test_overrides?: Record<string, unknown>;
    };
    const overrides = {
      ...(payload.test_overrides ?? {}),
      ...(payload.model ? { model: payload.model } : {})
    };
    const run = await createSingleRun({
      ...payload,
      test_overrides: Object.keys(overrides).length ? overrides : undefined
    });
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
