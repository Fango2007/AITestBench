import { FastifyInstance } from 'fastify';

import { getLeaderboard } from '../../services/leaderboard-service.js';

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function registerLeaderboardRoutes(app: FastifyInstance): void {
  app.get('/leaderboard', async (request, reply) => {
    const query = request.query as {
      date_from?: string;
      date_to?: string;
      tags?: string;
    };

    if (query.date_from && !isValidIsoDate(query.date_from)) {
      reply.code(400).send({ error: 'date_from must be a valid ISO-8601 date string' });
      return;
    }

    if (query.date_to && !isValidIsoDate(query.date_to)) {
      reply.code(400).send({ error: 'date_to must be a valid ISO-8601 date string' });
      return;
    }

    const tags = query.tags
      ? query.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const result = getLeaderboard({
      date_from: query.date_from,
      date_to: query.date_to,
      tags: tags.length > 0 ? tags : undefined
    });

    reply.code(200).send(result);
  });
}
