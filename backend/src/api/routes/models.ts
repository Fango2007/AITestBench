import { FastifyInstance } from 'fastify';

import { deleteModel } from '../../models/model.js';
import {
  InvalidModelError,
  archiveModel,
  createModelRecord,
  fetchModel,
  fetchModels,
  unarchiveModel,
  updateModelRecord
} from '../../services/models-repository.js';
import { modelCreateSchema, modelUpdateSchema } from '../models-schemas.js';

export function registerModelsRoutes(app: FastifyInstance): void {
  app.get('/models', async (request) => {
    const query = request.query as {
      active?: string;
      archived?: string;
      server_id?: string;
      provider?: 'openai' | 'meta' | 'mistral' | 'qwen' | 'google' | 'custom' | 'unknown';
    };
    const filters: {
      active?: boolean;
      archived?: boolean;
      server_id?: string;
      provider?: 'openai' | 'meta' | 'mistral' | 'qwen' | 'google' | 'custom' | 'unknown';
    } = {};
    if (query.active !== undefined) {
      filters.active = query.active === 'true';
    }
    if (query.archived !== undefined) {
      filters.archived = query.archived === 'true';
    }
    if (query.server_id) {
      filters.server_id = query.server_id;
    }
    if (query.provider) {
      filters.provider = query.provider;
    }
    return fetchModels(filters);
  });

  app.post('/models', { schema: modelCreateSchema }, async (request, reply) => {
    try {
      const model = createModelRecord(request.body as Record<string, unknown>);
      reply.code(201).send(model);
    } catch (error) {
      if (error instanceof InvalidModelError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get('/models/:serverId/:modelId', async (request, reply) => {
    const { serverId, modelId } = request.params as { serverId: string; modelId: string };
    const model = fetchModel(serverId, modelId);
    if (!model) {
      reply.code(404).send({ error: 'Model not found' });
      return;
    }
    reply.send(model);
  });

  app.patch('/models/:serverId/:modelId', { schema: modelUpdateSchema }, async (request, reply) => {
    const { serverId, modelId } = request.params as { serverId: string; modelId: string };
    try {
      const model = updateModelRecord(serverId, modelId, request.body as Record<string, unknown>);
      if (!model) {
        reply.code(404).send({ error: 'Model not found' });
        return;
      }
      reply.send(model);
    } catch (error) {
      if (error instanceof InvalidModelError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post('/models/:serverId/:modelId/archive', async (request, reply) => {
    const { serverId, modelId } = request.params as { serverId: string; modelId: string };
    const model = archiveModel(serverId, modelId);
    if (!model) {
      reply.code(404).send({ error: 'Model not found' });
      return;
    }
    reply.send(model);
  });

  app.post('/models/:serverId/:modelId/unarchive', async (request, reply) => {
    const { serverId, modelId } = request.params as { serverId: string; modelId: string };
    const model = unarchiveModel(serverId, modelId);
    if (!model) {
      reply.code(404).send({ error: 'Model not found' });
      return;
    }
    reply.send(model);
  });

  app.delete('/models/:serverId/:modelId', async (request, reply) => {
    const { serverId, modelId } = request.params as { serverId: string; modelId: string };
    const model = fetchModel(serverId, modelId);
    if (!model) {
      reply.code(404).send({ error: 'Model not found' });
      return;
    }
    const deleted = deleteModel(serverId, modelId);
    if (!deleted) {
      reply.code(500).send({ error: 'Unable to delete model' });
      return;
    }
    reply.code(204).send();
  });
}
