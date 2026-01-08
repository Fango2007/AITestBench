import { FastifyInstance } from 'fastify';

import {
  canDeleteTarget,
  createTargetRecord,
  fetchTarget,
  fetchTargets,
  removeTarget,
  updateTargetRecord
} from '../../services/target-service';

export function registerTargetsRoutes(app: FastifyInstance): void {
  app.get('/targets', async () => fetchTargets());

  app.post('/targets', async (request, reply) => {
    const target = createTargetRecord(request.body as Record<string, unknown>);
    reply.code(201).send(target);
  });

  app.get('/targets/:targetId', async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    const target = fetchTarget(targetId);
    if (!target) {
      reply.code(404).send({ error: 'Target not found' });
      return;
    }
    reply.send(target);
  });

  app.put('/targets/:targetId', async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    const target = updateTargetRecord(targetId, request.body as Record<string, unknown>);
    if (!target) {
      reply.code(404).send({ error: 'Target not found' });
      return;
    }
    reply.send(target);
  });

  app.delete('/targets/:targetId', async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    const guard = canDeleteTarget(targetId);
    if (!guard.ok) {
      reply.code(409).send({ error: guard.reason });
      return;
    }
    const removed = removeTarget(targetId);
    reply.code(removed ? 204 : 404).send();
  });
}
