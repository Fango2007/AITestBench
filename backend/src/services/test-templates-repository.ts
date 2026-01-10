import crypto from 'crypto';

import { getDb } from '../models/db';
import { nowIso } from '../models/repositories';
import {
  InstantiatedTestRecord,
  TestTemplateRecord,
  TestTemplateSummaryRecord,
  TestTemplateVersionRecord,
  countInstantiatedTestsByTemplate,
  createInstantiatedTest,
  createTemplateVersion,
  createTestTemplate,
  deleteTemplate,
  getActiveTemplateByName,
  getLatestTemplateVersionNumber,
  getTemplateVersion,
  getTemplateVersionById,
  getTestTemplateById,
  getTestTemplateByName,
  getTestTemplateSummaryById,
  listTemplateVersions,
  listTestTemplates,
  updateTestTemplate
} from '../models/test-template';
import { buildTemplatePath, deleteTemplateFile, writeTemplateFile } from './template-storage';

export interface TestTemplateCreateInput {
  name: string;
  format: 'json' | 'python';
  content: string;
}

export interface TestTemplateUpdateInput {
  name?: string;
  content: string;
}

export interface TestInstantiationInput {
  template_id: string;
  template_version_id: string;
}

export interface TestTemplateDetail extends TestTemplateSummaryRecord {
  versions: TestTemplateVersionRecord[];
}

const DEFAULT_OWNER_ID = 'local-owner';

export class DuplicateTemplateNameError extends Error {
  constructor(name: string) {
    super(`Template name already exists: ${name}`);
    this.name = 'DuplicateTemplateNameError';
  }
}

export class InvalidTemplateFormatError extends Error {
  constructor(format: string) {
    super(`Invalid template format: ${format}`);
    this.name = 'InvalidTemplateFormatError';
  }
}

export class InvalidTemplateContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTemplateContentError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor() {
    super('Template not found');
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateVersionNotFoundError extends Error {
  constructor() {
    super('Template version not found');
    this.name = 'TemplateVersionNotFoundError';
  }
}

export class ArchivedTemplateError extends Error {
  constructor() {
    super('Template is archived');
    this.name = 'ArchivedTemplateError';
  }
}

export class TemplateDeletionBlockedError extends Error {
  constructor() {
    super('Template has instantiated tests');
    this.name = 'TemplateDeletionBlockedError';
  }
}

function validateFormat(format: string): asserts format is 'json' | 'python' {
  if (format !== 'json' && format !== 'python') {
    throw new InvalidTemplateFormatError(format);
  }
}

function validateTemplateContent(format: 'json' | 'python', content: string): void {
  if (format === 'json') {
    try {
      JSON.parse(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON template';
      throw new InvalidTemplateContentError(message);
    }
    return;
  }

  if (!content.trim()) {
    throw new InvalidTemplateContentError('Python template content is empty');
  }
}

function buildTemplateId(name: string): string {
  const key = `${name}:${Date.now()}:${Math.random()}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

function buildTemplateVersionId(templateId: string, version: number): string {
  const key = `${templateId}:${version}:${Date.now()}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

function buildInstantiationId(templateId: string, versionId: string): string {
  const key = `${templateId}:${versionId}:${Date.now()}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

function assertUniqueActiveName(name: string, ignoreId?: string): void {
  const existing = getActiveTemplateByName(name);
  if (existing && existing.id !== ignoreId) {
    throw new DuplicateTemplateNameError(name);
  }
}

export function fetchTemplates(status?: 'active' | 'archived' | 'all'): TestTemplateSummaryRecord[] {
  return listTestTemplates(status);
}

export function fetchTemplateDetail(id: string): TestTemplateDetail | null {
  const summary = getTestTemplateSummaryById(id);
  if (!summary) {
    return null;
  }
  return {
    ...summary,
    versions: listTemplateVersions(id)
  };
}

export function fetchTemplateVersion(templateId: string, versionId: string): TestTemplateVersionRecord | null {
  return getTemplateVersion(templateId, versionId);
}

export function fetchTemplateVersions(templateId: string): TestTemplateVersionRecord[] | null {
  const template = getTestTemplateById(templateId);
  if (!template) {
    return null;
  }
  return listTemplateVersions(templateId);
}

export function createTemplate(input: TestTemplateCreateInput): TestTemplateSummaryRecord {
  validateFormat(input.format);
  validateTemplateContent(input.format, input.content);
  assertUniqueActiveName(input.name);

  const id = buildTemplateId(input.name);
  const storagePath = buildTemplatePath(id, input.format);
  const versionId = buildTemplateVersionId(id, 1);

  writeTemplateFile(storagePath, input.content);

  try {
    const db = getDb();
    const create = db.transaction(() => {
      createTestTemplate({
        id,
        name: input.name,
        format: input.format,
        status: 'active',
        owner_id: DEFAULT_OWNER_ID,
        current_version_id: null,
        storage_path: storagePath
      });

      createTemplateVersion({
        id: versionId,
        template_id: id,
        version_number: 1,
        content: input.content,
        created_by: DEFAULT_OWNER_ID
      });

      updateTestTemplate(id, { current_version_id: versionId, updated_at: nowIso() });
    });

    create();
  } catch (error) {
    deleteTemplateFile(storagePath);
    throw error;
  }

  const summary = getTestTemplateSummaryById(id);
  if (!summary) {
    throw new TemplateNotFoundError();
  }
  return summary;
}

export function updateTemplate(id: string, input: TestTemplateUpdateInput): TestTemplateSummaryRecord | null {
  const template = getTestTemplateById(id);
  if (!template) {
    return null;
  }

  if (input.name && input.name !== template.name) {
    assertUniqueActiveName(input.name, id);
  }

  validateTemplateContent(template.format, input.content);

  const nextVersion = getLatestTemplateVersionNumber(id) + 1;
  const versionId = buildTemplateVersionId(id, nextVersion);

  writeTemplateFile(template.storage_path, input.content);

  const db = getDb();
  const update = db.transaction(() => {
    createTemplateVersion({
      id: versionId,
      template_id: id,
      version_number: nextVersion,
      content: input.content,
      created_by: template.owner_id
    });

    updateTestTemplate(id, {
      name: input.name ?? template.name,
      current_version_id: versionId,
      updated_at: nowIso()
    });
  });

  update();
  return getTestTemplateSummaryById(id);
}

export function archiveTemplate(id: string): TestTemplateSummaryRecord | null {
  const template = updateTestTemplate(id, { status: 'archived' });
  if (!template) {
    return null;
  }
  return getTestTemplateSummaryById(id);
}

export function unarchiveTemplate(id: string): TestTemplateSummaryRecord | null {
  const template = getTestTemplateById(id);
  if (!template) {
    return null;
  }
  assertUniqueActiveName(template.name, id);
  updateTestTemplate(id, { status: 'active' });
  return getTestTemplateSummaryById(id);
}

export function deleteTemplateRecord(id: string): void {
  const template = getTestTemplateById(id);
  if (!template) {
    throw new TemplateNotFoundError();
  }

  if (countInstantiatedTestsByTemplate(id) > 0) {
    throw new TemplateDeletionBlockedError();
  }

  const removed = deleteTemplate(id);
  if (removed) {
    deleteTemplateFile(template.storage_path);
  }
}

export function instantiateTestFromTemplate(input: TestInstantiationInput): InstantiatedTestRecord {
  const template = getTestTemplateById(input.template_id);
  if (!template) {
    throw new TemplateNotFoundError();
  }
  if (template.status === 'archived') {
    throw new ArchivedTemplateError();
  }

  const version = getTemplateVersion(template.id, input.template_version_id);
  if (!version) {
    throw new TemplateVersionNotFoundError();
  }

  validateTemplateContent(template.format, version.content);

  const id = buildInstantiationId(template.id, version.id);
  return createInstantiatedTest({
    id,
    template_id: template.id,
    template_version_id: version.id
  });
}

export function fetchTemplateByName(name: string): TestTemplateRecord | null {
  return getTestTemplateByName(name);
}
