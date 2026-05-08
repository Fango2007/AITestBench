import { FastifyInstance } from 'fastify';

import {
  cancelRunGroup,
  createRunGroup,
  getRunGroupDetail,
  RunGroupValidationError
} from '../../services/run-group-service.js';

export function registerRunGroupsRoutes(app: FastifyInstance): void {
  app.post('/run-groups', async (request, reply) => {
    try {
      const group = createRunGroup(
        request.body as {
          targets: Array<{ inference_server_id: string; model_id: string }>;
          selected_template_ids: string[];
          test_overrides?: Record<string, unknown> | null;
          profile_id?: string | null;
          profile_version?: string | null;
        }
      );
      reply.code(201).send(group);
    } catch (error) {
      if (error instanceof RunGroupValidationError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get('/run-groups/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const group = getRunGroupDetail(groupId);
    if (!group) {
      reply.code(404).send({ error: 'Run group not found' });
      return;
    }
    reply.send(group);
  });

  app.post('/run-groups/:groupId/cancel', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const group = cancelRunGroup(groupId);
    if (!group) {
      reply.code(404).send({ error: 'Run group not found' });
      return;
    }
    reply.send(group);
  });
}
