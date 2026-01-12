import { FastifyInstance } from 'fastify';

import { getDb } from '../../models/db.js';
import { parseJson } from '../../models/repositories.js';

export function registerResultsRoutes(app: FastifyInstance): void {
  app.get('/results/:resultId', async (request, reply) => {
    const { resultId } = request.params as { resultId: string };
    const db = getDb();
    const row = db.prepare('SELECT * FROM test_results WHERE id = ?').get(resultId) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      reply.code(404).send({ error: 'Result not found' });
      return;
    }

    reply.send({
      ...row,
      metrics: parseJson(row.metrics as string),
      artefacts: parseJson(row.artefacts as string),
      raw_events: parseJson(row.raw_events as string),
      repetition_stats: parseJson(row.repetition_stats as string)
    });
  });
}
