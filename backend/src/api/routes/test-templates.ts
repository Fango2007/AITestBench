import { FastifyInstance } from 'fastify';

import {
  ArchivedTemplateError,
  DuplicateTemplateNameError,
  InvalidTemplateContentError,
  InvalidTemplateFormatError,
  TemplateDeletionBlockedError,
  TemplateNotFoundError,
  TemplateVersionNotFoundError,
  archiveTemplate,
  createTemplate,
  deleteTemplateRecord,
  fetchTemplateDetail,
  fetchTemplateVersion,
  fetchTemplateVersions,
  fetchTemplates,
  unarchiveTemplate,
  updateTemplate
} from '../../services/test-templates-repository';
import { instantiateTest } from '../../services/test-service';
import {
  testTemplateCreateSchema,
  testTemplateInstantiateSchema,
  testTemplateUpdateSchema
} from '../test-templates-schemas';

export function registerTestTemplatesRoutes(app: FastifyInstance): void {
  app.get('/test-templates', async (request) => {
    const { status } = request.query as { status?: 'active' | 'archived' | 'all' };
    return fetchTemplates(status);
  });

  app.post('/test-templates', { schema: testTemplateCreateSchema }, async (request, reply) => {
    try {
      const template = createTemplate(request.body as { name: string; format: 'json' | 'python'; content: string });
      reply.code(201).send(template);
    } catch (error) {
      if (error instanceof DuplicateTemplateNameError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      if (error instanceof InvalidTemplateFormatError || error instanceof InvalidTemplateContentError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get('/test-templates/:templateId', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const template = fetchTemplateDetail(templateId);
    if (!template) {
      reply.code(404).send({ error: 'Template not found' });
      return;
    }
    reply.send(template);
  });

  app.put('/test-templates/:templateId', { schema: testTemplateUpdateSchema }, async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    try {
      const template = updateTemplate(templateId, request.body as { name?: string; content: string });
      if (!template) {
        reply.code(404).send({ error: 'Template not found' });
        return;
      }
      reply.send(template);
    } catch (error) {
      if (error instanceof DuplicateTemplateNameError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      if (error instanceof InvalidTemplateContentError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.delete('/test-templates/:templateId', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    try {
      deleteTemplateRecord(templateId);
      reply.code(204).send();
    } catch (error) {
      if (error instanceof TemplateNotFoundError) {
        reply.code(404).send({ error: error.message });
        return;
      }
      if (error instanceof TemplateDeletionBlockedError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post('/test-templates/:templateId/archive', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const template = archiveTemplate(templateId);
    if (!template) {
      reply.code(404).send({ error: 'Template not found' });
      return;
    }
    reply.send(template);
  });

  app.post('/test-templates/:templateId/unarchive', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    try {
      const template = unarchiveTemplate(templateId);
      if (!template) {
        reply.code(404).send({ error: 'Template not found' });
        return;
      }
      reply.send(template);
    } catch (error) {
      if (error instanceof DuplicateTemplateNameError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.get('/test-templates/:templateId/versions', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const versions = fetchTemplateVersions(templateId);
    if (!versions) {
      reply.code(404).send({ error: 'Template not found' });
      return;
    }
    reply.send(versions);
  });

  app.get('/test-templates/:templateId/versions/:versionId', async (request, reply) => {
    const { templateId, versionId } = request.params as { templateId: string; versionId: string };
    const version = fetchTemplateVersion(templateId, versionId);
    if (!version) {
      reply.code(404).send({ error: 'Version not found' });
      return;
    }
    reply.send(version);
  });

  app.post('/tests/instantiate', { schema: testTemplateInstantiateSchema }, async (request, reply) => {
    try {
      const result = instantiateTest(request.body as { template_id: string; template_version_id: string });
      reply.code(201).send(result);
    } catch (error) {
      if (error instanceof TemplateNotFoundError || error instanceof TemplateVersionNotFoundError) {
        reply.code(404).send({ error: error.message });
        return;
      }
      if (error instanceof InvalidTemplateContentError || error instanceof ArchivedTemplateError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      throw error;
    }
  });
}
