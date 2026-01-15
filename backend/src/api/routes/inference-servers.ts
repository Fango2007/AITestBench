import { FastifyInstance } from 'fastify';

import {
  InvalidBaseUrlError,
  InvalidInferenceServerError,
  archiveInferenceServer,
  createInferenceServerRecord,
  fetchInferenceServer,
  fetchInferenceServers,
  canDeleteInferenceServer,
  unarchiveInferenceServer,
  updateInferenceServerRecord
} from '../../services/inference-servers-repository.js';
import { deleteInferenceServer } from '../../models/inference-server.js';
import { InferenceServerRefreshError, refreshDiscovery, refreshRuntime } from '../../services/inference-server-refresh.js';
import { checkInferenceServerHealth } from '../../services/inference-server-connectivity.js';
import { inferenceServerCreateSchema, inferenceServerUpdateSchema } from '../inference-servers-schemas.js';

export function registerInferenceServersRoutes(app: FastifyInstance): void {
  app.get('/inference-servers', async (request) => {
    const query = request.query as {
      active?: string;
      archived?: string;
      schema_family?: 'openai-compatible' | 'ollama' | 'custom';
    };
    const filters: { active?: boolean; archived?: boolean; schema_family?: 'openai-compatible' | 'ollama' | 'custom' } = {};
    if (query.active !== undefined) {
      filters.active = query.active === 'true';
    }
    if (query.archived !== undefined) {
      filters.archived = query.archived === 'true';
    }
    if (query.schema_family) {
      filters.schema_family = query.schema_family;
    }
    return fetchInferenceServers(filters);
  });

  app.post('/inference-servers', { schema: inferenceServerCreateSchema }, async (request, reply) => {
    try {
      const server = createInferenceServerRecord(request.body as Record<string, unknown>);
      reply.code(201).send(server);
    } catch (error) {
      if (error instanceof InvalidBaseUrlError || error instanceof InvalidInferenceServerError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get('/inference-servers/:serverId', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = fetchInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    reply.send(server);
  });

  app.patch('/inference-servers/:serverId', { schema: inferenceServerUpdateSchema }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    try {
      const server = updateInferenceServerRecord(serverId, request.body as Record<string, unknown>);
      if (!server) {
        reply.code(404).send({ error: 'Inference server not found' });
        return;
      }
      reply.send(server);
    } catch (error) {
      if (error instanceof InvalidBaseUrlError || error instanceof InvalidInferenceServerError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post('/inference-servers/:serverId/archive', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = archiveInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    reply.send(server);
  });

  app.post('/inference-servers/:serverId/unarchive', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = unarchiveInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    reply.send(server);
  });

  app.delete('/inference-servers/:serverId', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = fetchInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    const canDelete = canDeleteInferenceServer(serverId);
    if (!canDelete.ok) {
      reply.code(409).send({ error: canDelete.reason ?? 'Inference server cannot be deleted' });
      return;
    }
    const deleted = deleteInferenceServer(serverId);
    if (!deleted) {
      reply.code(500).send({ error: 'Unable to delete inference server' });
      return;
    }
    reply.code(204).send();
  });

  app.post('/inference-servers/:serverId/refresh-runtime', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = fetchInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    const refreshed = refreshRuntime(server);
    if (!refreshed) {
      reply.code(500).send({ error: 'Unable to refresh runtime' });
      return;
    }
    reply.send(refreshed);
  });

  app.post('/inference-servers/:serverId/refresh-discovery', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = fetchInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    try {
      const refreshed = await refreshDiscovery(server);
      reply.send(refreshed);
    } catch (error) {
      if (error instanceof InferenceServerRefreshError) {
        reply.code(502).send({ error: error.details });
        return;
      }
      throw error;
    }
  });

  app.get('/inference-servers/health', async (_request, reply) => {
    const results = await checkInferenceServerHealth();
    reply.send({ results });
  });
}
