import path from 'path';
import { fileURLToPath } from 'url';

import { FastifyInstance } from 'fastify';

import { ModelCallError, ServerNotFoundError, ServerUnreachableError, runEvalInference } from '../../services/eval-inference-service.js';
import { validateWithSchema } from '../../services/schema-validator.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_SCHEMA_PATH = path.resolve(moduleDir, '../../schemas/eval-prompt.schema.json');
const IC_SCHEMA_PATH = path.resolve(moduleDir, '../../schemas/inference-config.schema.json');

export function registerEvalInferenceRoutes(app: FastifyInstance): void {
  app.post('/eval-inference', async (request, reply) => {
    const body = request.body as {
      server_id?: string;
      model_name?: string;
      prompt_text?: string;
      inference_config?: unknown;
    };

    const promptValidation = validateWithSchema(PROMPT_SCHEMA_PATH, { text: body.prompt_text, tags: [] });
    if (!promptValidation.ok) {
      reply.code(400).send({ error: 'Invalid request', issues: promptValidation.issues });
      return;
    }

    if (body.inference_config !== undefined) {
      const icValidation = validateWithSchema(IC_SCHEMA_PATH, body.inference_config);
      if (!icValidation.ok) {
        reply.code(400).send({ error: 'Invalid inference_config', issues: icValidation.issues });
        return;
      }
    }

    if (!body.server_id || typeof body.server_id !== 'string') {
      reply.code(400).send({ error: 'server_id is required' });
      return;
    }
    if (!body.model_name || typeof body.model_name !== 'string') {
      reply.code(400).send({ error: 'model_name is required' });
      return;
    }

    const inferenceConfig = (body.inference_config as {
      temperature?: number | null;
      top_p?: number | null;
      max_tokens?: number | null;
      quantization_level?: string | null;
    } | null) ?? {};

    try {
      const result = await runEvalInference({
        server_id: body.server_id,
        model_name: body.model_name,
        prompt_text: body.prompt_text as string,
        inference_config: {
          temperature: inferenceConfig.temperature ?? null,
          top_p: inferenceConfig.top_p ?? null,
          max_tokens: inferenceConfig.max_tokens ?? null,
          quantization_level: inferenceConfig.quantization_level ?? null
        }
      });
      reply.code(200).send(result);
    } catch (err) {
      if (err instanceof ServerNotFoundError) {
        reply.code(404).send({ error: err.message });
        return;
      }
      if (err instanceof ServerUnreachableError) {
        reply.code(502).send({ error: err.message });
        return;
      }
      if (err instanceof ModelCallError) {
        reply.code(502).send({ error: err.message, upstream_status: err.upstreamStatus });
        return;
      }
      const error = err as Error;
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        reply.code(504).send({ error: 'Inference server did not respond in time' });
        return;
      }
      reply.code(502).send({ error: 'Inference call failed' });
    }
  });
}
