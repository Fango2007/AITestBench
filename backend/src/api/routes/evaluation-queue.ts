import { FastifyInstance } from 'fastify';

import {
  EvaluationQueueConflictError,
  getEvaluationQueueDetail,
  listEvaluationQueue,
  scoreEvaluationQueueItem,
  skipEvaluationQueueItem
} from '../../services/evaluation-queue-service.js';
import { EvaluationValidationError } from '../../services/evaluation-service.js';

export function registerEvaluationQueueRoutes(app: FastifyInstance): void {
  app.get('/evaluation-queue', async (request, reply) => {
    const { status } = request.query as { status?: string };
    const normalized = status === 'done' || status === 'skipped' ? status : 'pending';
    reply.send(listEvaluationQueue(normalized));
  });

  app.get('/evaluation-queue/:testResultId', async (request, reply) => {
    const { testResultId } = request.params as { testResultId: string };
    const detail = getEvaluationQueueDetail(testResultId);
    if (!detail) {
      reply.code(404).send({ error: 'Evaluation queue item not found' });
      return;
    }
    reply.send(detail);
  });

  app.post('/evaluation-queue/:testResultId/score', async (request, reply) => {
    const { testResultId } = request.params as { testResultId: string };
    try {
      const evaluation = await scoreEvaluationQueueItem(testResultId, request.body as Record<string, unknown>);
      if (!evaluation) {
        reply.code(404).send({ error: 'Evaluation queue item not found' });
        return;
      }
      reply.code(201).send(evaluation);
    } catch (error) {
      if (error instanceof EvaluationQueueConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      if (error instanceof EvaluationValidationError) {
        reply.code(400).send({ error: 'Validation failed', issues: error.issues });
        return;
      }
      throw error;
    }
  });

  app.post('/evaluation-queue/:testResultId/skip', async (request, reply) => {
    const { testResultId } = request.params as { testResultId: string };
    const body = request.body as { reason?: unknown } | undefined;
    if (!skipEvaluationQueueItem(testResultId, body?.reason)) {
      reply.code(404).send({ error: 'Evaluation queue item not found' });
      return;
    }
    reply.code(204).send();
  });
}
