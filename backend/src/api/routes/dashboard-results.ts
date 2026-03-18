import { FastifyInstance } from 'fastify';

import {
  listDashboardFilterOptions,
  queryDashboardResults,
  validateAndNormalizeDashboardInput
} from '../../services/dashboard-results-service.js';

function normalizeQueryPayload(query: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    date_from: query.date_from,
    date_to: query.date_to
  };
  return payload;
}

export function registerDashboardResultsRoutes(app: FastifyInstance): void {
  app.get('/dashboard-results/filters', async (request, reply) => {
    const queryPayload = normalizeQueryPayload((request.query as Record<string, unknown>) ?? {});
    const validated = validateAndNormalizeDashboardInput(queryPayload);
    if (!validated.ok) {
      reply.code(400).send({ error: validated.error, code: validated.code, details: validated.details ?? null });
      return;
    }

    const response = listDashboardFilterOptions(queryPayload);
    if (!response.ok) {
      reply.code(400).send({ error: response.error, code: response.code });
      return;
    }

    reply.send(response.value);
  });

  app.post('/dashboard-results/query', async (request, reply) => {
    const payload = (request.body as Record<string, unknown> | undefined) ?? {};
    const response = queryDashboardResults(payload);
    if (!response.ok) {
      const clientErrorCodes = new Set([
        'INCOMPATIBLE_GROUPING',
        'INVALID_DATE_RANGE',
        'DATE_RANGE_TOO_LARGE',
        'GROUP_KEYS_REQUIRED'
      ]);
      const status = clientErrorCodes.has(response.code) ? 400 : 500;
      reply.code(status).send({ error: response.error, code: response.code, details: response.details ?? null });
      return;
    }

    reply.send(response.value);
  });
}
