import { FastifyInstance } from 'fastify';

import { getSystemMetrics } from '../../services/system-metrics.js';
import { clearDatabase, listEnvEntries, setEnvEntry } from '../../services/system-settings.js';

export function registerSystemRoutes(app: FastifyInstance): void {
  app.get('/system/metrics', async () => getSystemMetrics());

  app.get('/system/connectivity-config', async () => {
    const pollIntervalMs = Number(process.env.CONNECTIVITY_POLL_INTERVAL_MS || 30000);
    return { poll_interval_ms: pollIntervalMs };
  });

  app.post('/system/clear-db', async (_request, reply) => {
    clearDatabase();
    reply.send({ status: 'ok' });
  });

  app.get('/system/env', async () => ({ entries: listEnvEntries() }));

  app.post('/system/env', async (request, reply) => {
    const body = request.body as { key?: string; value?: string | null };
    const key = body?.key?.trim();
    if (!key) {
      reply.code(400).send({ error: 'key is required' });
      return;
    }
    try {
      const value = body.value === undefined ? '' : body.value;
      const entries = setEnvEntry(key, value);
      reply.send({ entries });
    } catch (error) {
      reply.code(400).send({ error: error instanceof Error ? error.message : 'Unable to update env' });
    }
  });
}
