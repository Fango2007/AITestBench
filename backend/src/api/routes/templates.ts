import { FastifyInstance } from 'fastify';

import {
  DuplicateTemplateIdError,
  DuplicateTemplateNameError,
  TemplateContentError,
  TemplateInput,
  TemplateNotFoundError,
  createTemplateRecord,
  instantiateActiveTests,
  listActiveTests,
  listTemplateRecords,
  removeActiveTest,
  removeTemplateRecord,
  updateTemplateRecord
} from '../../services/template-service.js';
import { TemplateStorageError } from '../../services/template-storage.js';

export function registerTemplatesRoutes(app: FastifyInstance): void {
  app.get('/templates', async (_request, reply) => {
    try {
      return listTemplateRecords();
    } catch (error) {
      if (error instanceof TemplateStorageError) {
        reply.code(500).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post('/templates', async (request, reply) => {
    try {
      const template = createTemplateRecord(request.body as TemplateInput);
      reply.code(201).send(template);
    } catch (error) {
      if (error instanceof TemplateStorageError) {
        reply.code(500).send({ error: error.message });
        return;
      }
      if (error instanceof DuplicateTemplateIdError || error instanceof DuplicateTemplateNameError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      if (error instanceof TemplateContentError) {
        reply.code(400).send({ error: error.message, issues: error.issues });
        return;
      }
      throw error;
    }
  });

  app.put('/templates/:templateId', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    try {
      const template = updateTemplateRecord(
        templateId,
        request.body as Omit<TemplateInput, 'id'>
      );
      reply.send(template);
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        reply.code(404).send({ error: error.message });
        return;
      }
      if (error instanceof TemplateStorageError) {
        reply.code(500).send({ error: error.message });
        return;
      }
      if (error instanceof DuplicateTemplateIdError || error instanceof DuplicateTemplateNameError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      if (error instanceof TemplateContentError) {
        reply.code(400).send({ error: error.message, issues: error.issues });
        return;
      }
      throw error;
    }
  });

  app.delete('/templates/:templateId', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    try {
      const removed = removeTemplateRecord(templateId);
      reply.code(removed ? 204 : 404).send();
    } catch (error) {
      if (error instanceof TemplateStorageError) {
        reply.code(500).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get('/active-tests', async () => listActiveTests());

  app.post('/active-tests/instantiate', async (request, reply) => {
    const payload = request.body as {
      target_id: string;
      model_name: string;
      template_ids: string[];
      param_overrides?: Record<string, unknown>;
    };
    try {
      const records = instantiateActiveTests(payload);
      reply.code(201).send(records);
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        reply.code(404).send({ error: error.message });
        return;
      }
      if (error instanceof TemplateStorageError) {
        reply.code(500).send({ error: error.message });
        return;
      }
      if (error instanceof TemplateContentError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.delete('/active-tests/:activeTestId', async (request, reply) => {
    const { activeTestId } = request.params as { activeTestId: string };
    const removed = removeActiveTest(activeTestId);
    reply.code(removed ? 204 : 404).send();
  });
}
