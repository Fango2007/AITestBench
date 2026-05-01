import path from 'path';
import { fileURLToPath } from 'url';
import { FastifyInstance } from 'fastify';

import { getModelById } from '../../models/model.js';
import { getDb } from '../../models/db.js';
import {
  sanitizeModelId,
  readCachedTree,
  runInspection,
  deleteCacheFiles,
  ArchitectureTree,
  InspectorError,
} from '../../adapters/architecture-inspector.js';
import { validateWithSchema } from '../../services/schema-validator.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_SCHEMA = path.resolve(moduleDir, '../../schemas/architecture-settings.schema.json');

const HF_MODEL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]+$/;

function isInspectorError(v: ArchitectureTree | InspectorError): v is InspectorError {
  return 'code' in v && !('schema_version' in v);
}

function errorToHttp(err: InspectorError): { status: number; body: { error: string; code: string } } {
  switch (err.code) {
    case 'inspection_in_progress':
      return { status: 409, body: { error: 'Inspection already in progress for this model.', code: err.code } };
    case 'concurrency_limit':
      return { status: 503, body: { error: 'Too many concurrent inspections. Please retry later.', code: err.code } };
    case 'not_inspectable':
      return { status: 422, body: { error: 'This model is not inspectable.', code: err.code } };
    case 'hf_token_required':
      return {
        status: 401,
        body: {
          error: 'This model requires a Hugging Face API token. Add your token in Settings → Environment.',
          code: err.code,
        },
      };
    case 'unregistered_architecture':
      return {
        status: 400,
        body: {
          error: 'This model requires remote code execution. Enable it in Architecture Settings for this model.',
          code: err.code,
        },
      };
    case 'not_cached':
      return { status: 404, body: { error: 'No cached architecture found.', code: err.code } };
    default:
      return {
        status: 500,
        body: {
          error: (err as { code: string; message?: string }).message ?? 'Inspection failed.',
          code: (err as { code: string }).code,
        },
      };
  }
}

function getArchitectureSettings(serverId: string, modelId: string): { trust_remote_code: boolean } {
  const db = getDb();
  const row = db
    .prepare('SELECT trust_remote_code FROM model_architecture_settings WHERE server_id = ? AND model_id = ?')
    .get(serverId, modelId) as { trust_remote_code: number } | undefined;
  return { trust_remote_code: row ? row.trust_remote_code === 1 : false };
}

export function registerArchitectureRoutes(app: FastifyInstance): void {
  // POST — inspect or return cache
  app.post<{ Params: { serverId: string; modelId: string } }>(
    '/models/:serverId/:modelId/architecture',
    async (request, reply) => {
      const { serverId, modelId } = request.params;

      const model = getModelById(serverId, modelId);
      if (!model) {
        return reply.code(404).send({ error: 'Model not found.', code: 'model_not_found' });
      }

      // GGUF without a local path is not inspectable in this release
      if (model.architecture.format === 'GGUF') {
        return reply.code(422).send({ error: 'This model is not inspectable.', code: 'not_inspectable' });
      }

      // Only HF-style IDs are inspectable via transformers
      if (!HF_MODEL_ID_RE.test(modelId)) {
        return reply.code(422).send({ error: 'This model is not inspectable.', code: 'not_inspectable' });
      }

      let sanitized: string;
      try {
        sanitized = sanitizeModelId(modelId);
      } catch {
        return reply.code(422).send({ error: 'This model is not inspectable.', code: 'not_inspectable' });
      }

      // Check cache first
      const cached = readCachedTree(sanitized);
      if (!isInspectorError(cached)) {
        return reply.send(cached);
      }

      // Cold inspection
      const settings = getArchitectureSettings(serverId, modelId);
      const result = await runInspection({
        modelId,
        sanitizedId: sanitized,
        format: 'transformers',
        trustRemoteCode: settings.trust_remote_code,
      });

      if (isInspectorError(result)) {
        const { status, body } = errorToHttp(result);
        return reply.code(status).send(body);
      }

      return reply.send(result);
    }
  );

  // GET — cache only
  app.get<{ Params: { serverId: string; modelId: string } }>(
    '/models/:serverId/:modelId/architecture',
    async (request, reply) => {
      const { serverId, modelId } = request.params;

      const model = getModelById(serverId, modelId);
      if (!model) {
        return reply.code(404).send({ error: 'Model not found.', code: 'model_not_found' });
      }

      let sanitized: string;
      try {
        sanitized = sanitizeModelId(modelId);
      } catch {
        return reply.code(422).send({ error: 'This model is not inspectable.', code: 'not_inspectable' });
      }

      const cached = readCachedTree(sanitized);
      if (isInspectorError(cached)) {
        const { status, body } = errorToHttp(cached);
        return reply.code(status).send(body);
      }

      return reply.send(cached);
    }
  );

  // DELETE — clear cache
  app.delete<{ Params: { serverId: string; modelId: string } }>(
    '/models/:serverId/:modelId/architecture',
    async (request, reply) => {
      const { serverId, modelId } = request.params;

      const model = getModelById(serverId, modelId);
      if (!model) {
        return reply.code(404).send({ error: 'Model not found.', code: 'model_not_found' });
      }

      let sanitized: string;
      try {
        sanitized = sanitizeModelId(modelId);
      } catch {
        return reply.code(204).send();
      }

      deleteCacheFiles(sanitized);
      return reply.code(204).send();
    }
  );

  // GET settings
  app.get<{ Params: { serverId: string; modelId: string } }>(
    '/models/:serverId/:modelId/architecture/settings',
    async (request, reply) => {
      const { serverId, modelId } = request.params;
      return reply.send(getArchitectureSettings(serverId, modelId));
    }
  );

  // PATCH settings
  app.patch<{ Params: { serverId: string; modelId: string }; Body: { trust_remote_code: boolean } }>(
    '/models/:serverId/:modelId/architecture/settings',
    async (request, reply) => {
      const { serverId, modelId } = request.params;

      const validation = validateWithSchema(SETTINGS_SCHEMA, request.body);
      if (!validation.ok) {
        return reply.code(400).send({ error: 'Invalid request body.', code: 'invalid_body' });
      }

      const { trust_remote_code } = request.body;
      const now = new Date().toISOString();
      const db = getDb();
      db.prepare(
        `INSERT INTO model_architecture_settings (server_id, model_id, trust_remote_code, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (server_id, model_id)
         DO UPDATE SET trust_remote_code = excluded.trust_remote_code, updated_at = excluded.updated_at`
      ).run(serverId, modelId, trust_remote_code ? 1 : 0, now);

      return reply.send(getArchitectureSettings(serverId, modelId));
    }
  );
}
