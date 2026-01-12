import crypto from 'crypto';

import {
  TemplateFile,
  TemplateType,
  deleteTemplateFiles,
  getTemplateById,
  listTemplates,
  writeTemplateFile
} from './template-storage.js';
import { validateTemplateContent } from './template-validation.js';
import { createActiveTest, listActiveTests as listActiveTestRecords, deleteActiveTest } from '../models/active-test.js';
import { upsertTestDefinition } from '../models/test-definition.js';
import { getTargetById } from '../models/target.js';

export interface TemplateInput {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
  version: string;
}

export class DuplicateTemplateIdError extends Error {
  constructor(id: string) {
    super(`Template id already exists: ${id}`);
    this.name = 'DuplicateTemplateIdError';
  }
}

export class DuplicateTemplateNameError extends Error {
  constructor(name: string) {
    super(`Template name already exists: ${name}`);
    this.name = 'DuplicateTemplateNameError';
  }
}

export class TemplateContentError extends Error {
  issues: { message: string; path?: string }[];
  constructor(issues: { message: string; path?: string }[]) {
    super(issues.map((issue) => issue.message).join('; '));
    this.name = 'TemplateContentError';
    this.issues = issues;
  }
}

export class TemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Template not found: ${id}`);
    this.name = 'TemplateNotFoundError';
  }
}

function assertSafeId(id: string): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new TemplateContentError([{ message: 'Template id contains unsupported characters.' }]);
  }
}

function normalizeInput(input: TemplateInput): TemplateInput {
  return {
    id: input.id.trim(),
    name: input.name.trim(),
    type: input.type,
    content: input.content,
    version: input.version.trim()
  };
}

function ensureUnique(
  templates: TemplateFile[],
  input: TemplateInput,
  excludeId?: string
): void {
  const duplicateId = templates.find((template) => template.id === input.id && template.id !== excludeId);
  if (duplicateId) {
    throw new DuplicateTemplateIdError(input.id);
  }
  const duplicateName = templates.find(
    (template) => template.name === input.name && template.id !== excludeId
  );
  if (duplicateName) {
    throw new DuplicateTemplateNameError(input.name);
  }
}

function validateContent(input: TemplateInput): TemplateInput {
  const issues = validateTemplateContent(input.type, input.content);
  if (issues.length > 0) {
    throw new TemplateContentError(issues);
  }
  if (input.type === 'json') {
    const parsed = JSON.parse(input.content) as Record<string, unknown>;
    parsed.id = input.id;
    parsed.name = input.name;
    parsed.version = input.version;
    return {
      ...input,
      content: JSON.stringify(parsed, null, 2)
    };
  }
  return input;
}

export function listTemplateRecords(): TemplateFile[] {
  return listTemplates();
}

export function createTemplateRecord(input: TemplateInput): TemplateFile {
  const normalized = normalizeInput(input);
  assertSafeId(normalized.id);
  const templates = listTemplates();
  ensureUnique(templates, normalized);
  const validated = validateContent(normalized);
  return writeTemplateFile(validated);
}

export function updateTemplateRecord(id: string, input: Omit<TemplateInput, 'id'>): TemplateFile {
  const existing = getTemplateById(id);
  if (!existing) {
    throw new TemplateNotFoundError(id);
  }
  const normalized: TemplateInput = normalizeInput({ ...input, id });
  assertSafeId(normalized.id);
  const templates = listTemplates();
  ensureUnique(templates, normalized, id);
  const validated = validateContent(normalized);
  const updated = writeTemplateFile(validated);
  if (existing.filePath !== updated.filePath) {
    deleteTemplateFiles(existing);
  }
  return updated;
}

export function removeTemplateRecord(id: string): boolean {
  const existing = getTemplateById(id);
  if (!existing) {
    return false;
  }
  deleteTemplateFiles(existing);
  return true;
}

export function listActiveTests() {
  return listActiveTestRecords();
}

function buildActiveTestId(templateId: string, modelName: string): string {
  const base = `${templateId}-${modelName}`;
  const digest = crypto.createHash('sha256').update(`${base}:${Date.now()}`).digest('hex').slice(0, 8);
  const slug = base.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `${slug}-${digest}`;
}

function applyParamOverrides(
  bodyTemplate: Record<string, unknown>,
  overrides?: Record<string, unknown> | null
): Record<string, unknown> {
  if (!overrides) {
    return bodyTemplate;
  }
  const allowedKeys = [
    'model',
    'messages',
    'prompt',
    'temperature',
    'top_p',
    'top_k',
    'max_tokens',
    'max_completion_tokens',
    'stream',
    'seed',
    'presence_penalty',
    'frequency_penalty',
    'repetition_penalty',
    'stop',
    'tools',
    'tool_choice'
  ];
  const filtered: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in overrides) {
      filtered[key] = overrides[key];
    }
  }
  return { ...bodyTemplate, ...filtered };
}

function buildCommandPreview(
  template: TemplateFile,
  modelName: string,
  targetId: string,
  paramOverrides?: Record<string, unknown> | null
): string | null {
  if (template.type !== 'json') {
    return null;
  }
  const parsed = JSON.parse(template.content) as Record<string, unknown>;
  const request = (parsed.request as Record<string, unknown>) ?? {};
  const method = String(request.method ?? 'POST').toUpperCase();
  const path = String(request.path ?? '/v1/chat/completions');
  const bodyTemplate = (request.body_template as Record<string, unknown>) ?? {};
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(request.headers as Record<string, string> | undefined)
  };
  if (modelName) {
    bodyTemplate.model = modelName;
  }

  const target = getTargetById(targetId);
  const baseUrl = target?.base_url ?? 'http://localhost:8080';
  if (target?.auth_token_ref) {
    headers.authorization = `Bearer $${target.auth_token_ref}`;
  }

  const url = new URL(path, baseUrl).toString();
  const headerLines = Object.entries(headers).map(
    ([key, value]) => `  -H \"${key}: ${value}\" \\`
  );
  const mergedBody = applyParamOverrides(bodyTemplate, paramOverrides);
  const body = JSON.stringify(mergedBody);
  const lines = [
    `curl -X ${method} \"${url}\" \\`,
    ...headerLines,
    `  -d '${body}'`
  ];
  return lines.join('\n');
}

export function instantiateActiveTests(input: {
  target_id: string;
  model_name: string;
  template_ids: string[];
  param_overrides?: Record<string, unknown>;
}) {
  if (!input.target_id || !input.model_name) {
    throw new TemplateContentError([
      { message: 'target_id and model_name are required for instantiation.' }
    ]);
  }
  if (!Array.isArray(input.template_ids) || input.template_ids.length === 0) {
    throw new TemplateContentError([{ message: 'template_ids must contain at least one entry.' }]);
  }
  const templates = listTemplates();
  const selected = templates.filter((template) => input.template_ids.includes(template.id));
  const missing = input.template_ids.filter(
    (templateId) => !selected.some((template) => template.id === templateId)
  );
  if (missing.length > 0) {
    throw new TemplateNotFoundError(missing[0]);
  }

  return selected.map((template) => {
    const activeTestId = buildActiveTestId(template.id, input.model_name);
    if (template.type === 'json') {
      const parsed = JSON.parse(template.content) as Record<string, unknown>;
      upsertTestDefinition({
        id: activeTestId,
        version: template.version,
        name: `${template.name} (${input.model_name})`,
        description: String(parsed.description ?? ''),
        category: null,
        tags: [],
        protocols: (parsed.protocols as string[]) ?? [],
        spec_path: template.filePath,
        runner_type: template.type,
        request_template: (parsed.request as Record<string, unknown>) ?? null,
        assertions: (parsed.assertions as Record<string, unknown>[]) ?? [],
        metric_rules: (parsed.metrics as Record<string, unknown>) ?? null
      });
    }

    return createActiveTest({
      id: activeTestId,
      template_id: template.id,
      template_version: template.version,
      target_id: input.target_id,
      model_name: input.model_name,
      status: 'ready',
      version: template.version,
      command_preview: buildCommandPreview(
        template,
        input.model_name,
        input.target_id,
        input.param_overrides
      ),
      python_ready: template.type === 'python'
    });
  });
}

export function removeActiveTest(id: string): boolean {
  return deleteActiveTest(id);
}
