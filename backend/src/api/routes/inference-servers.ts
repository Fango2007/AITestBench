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
import { InferenceServerRecord, deleteInferenceServer } from '../../models/inference-server.js';
import { InferenceServerRefreshError, refreshDiscovery, refreshRuntime } from '../../services/inference-server-refresh.js';
import { checkInferenceServerHealth } from '../../services/inference-server-connectivity.js';
import { probeServer } from '../../services/inference-server-probe.js';
import { buildProbeAuthHeaders } from '../../services/inference-server-auth.js';
import { inferenceServerCreateSchema, inferenceServerUpdateSchema } from '../inference-servers-schemas.js';

function sanitizeServer(server: InferenceServerRecord): InferenceServerRecord {
  const { token, ...auth } = server.auth;
  return {
    ...server,
    auth: {
      ...auth,
      token: null,
      token_present: Boolean(token)
    }
  };
}

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
    return fetchInferenceServers(filters).map(sanitizeServer);
  });

  app.post('/inference-servers', { schema: inferenceServerCreateSchema }, async (request, reply) => {
    try {
      const server = createInferenceServerRecord(request.body as Record<string, unknown>);
      reply.code(201).send(sanitizeServer(server));
    } catch (error) {
      if (error instanceof InvalidBaseUrlError || error instanceof InvalidInferenceServerError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post('/inference-servers/probe', async (request, reply) => {
    const body = request.body as {
      base_url: string;
      schema_family: string[];
      auth: { type: string; header_name: string; token?: string | null; token_env?: string | null };
      timeout_ms?: number;
    };
    const result = await probeServer({
      base_url: body.base_url,
      schema_families: body.schema_family,
      auth_headers: buildProbeAuthHeaders(body.auth),
      timeout_ms: body.timeout_ms
    });
    reply.send({
      ok: result.ok,
      status_code: result.status_code,
      response_time_ms: result.response_time_ms,
      models: result.models.map((m) => m.model_id),
      error: result.error ?? null
    });
  });

  app.get('/inference-servers/:serverId', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = fetchInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    reply.send(sanitizeServer(server));
  });

  app.patch('/inference-servers/:serverId', { schema: inferenceServerUpdateSchema }, async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    try {
      const server = updateInferenceServerRecord(serverId, request.body as Record<string, unknown>);
      if (!server) {
        reply.code(404).send({ error: 'Inference server not found' });
        return;
      }
      reply.send(sanitizeServer(server));
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
    reply.send(sanitizeServer(server));
  });

  app.post('/inference-servers/:serverId/unarchive', async (request, reply) => {
    const { serverId } = request.params as { serverId: string };
    const server = unarchiveInferenceServer(serverId);
    if (!server) {
      reply.code(404).send({ error: 'Inference server not found' });
      return;
    }
    reply.send(sanitizeServer(server));
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
    reply.send(sanitizeServer(refreshed));
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
      reply.send(sanitizeServer(refreshed));
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
