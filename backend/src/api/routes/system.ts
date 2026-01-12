import { FastifyInstance } from 'fastify';

import { getSystemMetrics } from '../../services/system-metrics.js';

export function registerSystemRoutes(app: FastifyInstance): void {
  app.get('/system/metrics', async () => getSystemMetrics());
}
