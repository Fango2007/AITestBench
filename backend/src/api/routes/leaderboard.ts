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
      server_ids?: string;
      model_names?: string;
      score_min?: string;
      score_max?: string;
      sort_by?: string;
      group_by?: string;
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
    const serverIds = query.server_ids
      ? query.server_ids.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    const modelNames = query.model_names
      ? query.model_names.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    const scoreMin = query.score_min == null || query.score_min === '' ? undefined : Number(query.score_min);
    const scoreMax = query.score_max == null || query.score_max === '' ? undefined : Number(query.score_max);

    if ((scoreMin != null && (!Number.isFinite(scoreMin) || scoreMin < 0 || scoreMin > 100))
      || (scoreMax != null && (!Number.isFinite(scoreMax) || scoreMax < 0 || scoreMax > 100))) {
      reply.code(400).send({ error: 'score_min and score_max must be numbers between 0 and 100' });
      return;
    }

    const sortBy = query.sort_by === 'latency' || query.sort_by === 'cost' || query.sort_by === 'pass_rate'
      ? query.sort_by
      : 'score';
    const groupBy = query.group_by === 'server' || query.group_by === 'quantization'
      ? query.group_by
      : 'model';

    const result = getLeaderboard({
      date_from: query.date_from,
      date_to: query.date_to,
      tags: tags.length > 0 ? tags : undefined,
      server_ids: serverIds.length > 0 ? serverIds : undefined,
      model_names: modelNames.length > 0 ? modelNames : undefined,
      score_min: scoreMin,
      score_max: scoreMax,
      sort_by: sortBy,
      group_by: groupBy
    });

    reply.code(200).send(result);
  });
}
