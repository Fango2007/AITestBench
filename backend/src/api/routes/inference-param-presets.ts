import { FastifyInstance } from 'fastify';

import {
  InferenceParamPresetValidationError,
  createInferenceParamPreset,
  deleteInferenceParamPreset,
  listInferenceParamPresets,
  updateInferenceParamPreset
} from '../../services/inference-param-presets-service.js';

export function registerInferenceParamPresetRoutes(app: FastifyInstance): void {
  app.get('/inference-param-presets', async (_request, reply) => {
    reply.send({ items: listInferenceParamPresets() });
  });

  app.post('/inference-param-presets', async (request, reply) => {
    try {
      const preset = createInferenceParamPreset(request.body as Record<string, unknown>);
      reply.code(201).send(preset);
    } catch (error) {
      if (error instanceof InferenceParamPresetValidationError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.patch('/inference-param-presets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const preset = updateInferenceParamPreset(id, request.body as Record<string, unknown>);
      if (!preset) {
        reply.code(404).send({ error: 'Preset not found' });
        return;
      }
      reply.send(preset);
    } catch (error) {
      if (error instanceof InferenceParamPresetValidationError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.delete('/inference-param-presets/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!deleteInferenceParamPreset(id)) {
      reply.code(404).send({ error: 'Preset not found' });
      return;
    }
    reply.code(204).send();
  });
}
