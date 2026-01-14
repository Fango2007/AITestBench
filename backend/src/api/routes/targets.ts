import { FastifyInstance } from 'fastify';

import {
  DuplicateTargetNameError,
  InvalidBaseUrlError,
  archiveTarget,
  canDeleteTarget,
  createTargetRecord,
  fetchTarget,
  fetchTargets,
  removeTarget,
  updateTargetConnectivity,
  updateTargetModel,
  updateTargetRecord
} from '../../services/targets-repository.js';
import { queueConnectivityCheck } from '../../services/connectivity-runner.js';
import { probeContextWindow } from '../../services/model-probe.js';
import { targetCreateSchema, targetUpdateSchema } from '../targets-schemas.js';
import { nowIso } from '../../models/repositories.js';

export function registerTargetsRoutes(app: FastifyInstance): void {
  app.get('/targets', async (request) => {
    const { status } = request.query as { status?: 'active' | 'archived' | 'all' };
    return fetchTargets(status);
  });

  app.post('/targets', { schema: targetCreateSchema }, async (request, reply) => {
    try {
      const target = createTargetRecord(request.body as Record<string, unknown>);
      queueConnectivityCheck(target.id);
      reply.code(201).send(target);
    } catch (error) {
      if (error instanceof DuplicateTargetNameError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      if (error instanceof InvalidBaseUrlError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
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

  app.put('/targets/:targetId', { schema: targetUpdateSchema }, async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    try {
      const target = updateTargetRecord(targetId, request.body as Record<string, unknown>);
      if (!target) {
        reply.code(404).send({ error: 'Target not found' });
        return;
      }
      updateTargetConnectivity(targetId, {
        connectivity_status: 'pending',
        last_check_at: nowIso(),
        last_error: null,
        models: target.models ?? null
      });
      queueConnectivityCheck(targetId);
      reply.send(fetchTarget(targetId));
    } catch (error) {
      if (error instanceof DuplicateTargetNameError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      if (error instanceof InvalidBaseUrlError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post('/targets/:targetId/archive', async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    const target = archiveTarget(targetId);
    if (!target) {
      reply.code(404).send({ error: 'Target not found' });
      return;
    }
    reply.send(target);
  });

  app.post('/targets/:targetId/connectivity-check', async (request, reply) => {
    const { targetId } = request.params as { targetId: string };
    const target = fetchTarget(targetId);
    if (!target) {
      reply.code(404).send({ error: 'Target not found' });
      return;
    }
    updateTargetConnectivity(targetId, {
      connectivity_status: 'pending',
      last_check_at: nowIso(),
      last_error: null,
      models: target.models ?? null
    });
    queueConnectivityCheck(targetId);
    reply.code(202).send({ status: 'queued' });
  });

  app.post('/targets/:targetId/models/:modelId/context-probe', async (request, reply) => {
    const { targetId, modelId } = request.params as { targetId: string; modelId: string };
    const target = fetchTarget(targetId);
    if (!target || !target.models) {
      reply.code(404).send({ error: 'Target not found' });
      return;
    }
    const model = target.models.find(
      (entry) => entry.model_id === modelId || entry.api_model_name === modelId
    );
    if (!model) {
      reply.code(404).send({ error: 'Model not found' });
      return;
    }
    if (model.context_window) {
      reply.send({ model });
      return;
    }
    const contextWindow = await probeContextWindow(target, model);
    if (!contextWindow) {
      reply.code(400).send({ error: 'Context probe failed' });
      return;
    }
    const updated = updateTargetModel(targetId, model.model_id, { context_window: contextWindow });
    const updatedModel =
      updated?.models?.find((entry) => entry.model_id === model.model_id) ?? {
        ...model,
        context_window: contextWindow
      };
    reply.send({ model: updatedModel });
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
