import path from 'path';
import { fileURLToPath } from 'url';

import { validateJsonTestSpec } from '../plugins/json-validator.js';
import { SchemaValidationIssue, validateWithSchema } from './schema-validator.js';

export type TemplateType = 'json' | 'python';

export interface TemplateValidationError {
  message: string;
  path?: string;
}

function resolveSchemaPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '../../../specs/004-test-template-schema/json-test-template-schema.json');
}

function resolvePythonSchemaPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(
    moduleDir,
    '../../../specs/006-python-test-template-schema/python-test-template-schema.json'
  );
}

function validateScenarioTemplate(spec: Record<string, unknown>): TemplateValidationError[] {
  try {
    const result = validateWithSchema(resolveSchemaPath(), spec);
    if (result.ok) {
      return [];
    }
    return result.issues.map((issue: SchemaValidationIssue) => ({
      message: issue.message,
      path: issue.path
    }));
  } catch (error) {
    return [
      {
        message: `Failed to load scenario schema: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    ];
  }
}

function validatePythonTemplate(spec: Record<string, unknown>): TemplateValidationError[] {
  try {
    const result = validateWithSchema(resolvePythonSchemaPath(), spec);
    if (result.ok) {
      return [];
    }
    return result.issues.map((issue: SchemaValidationIssue) => ({
      message: issue.message,
      path: issue.path
    }));
  } catch (error) {
    return [
      {
        message: `Failed to load python schema: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    ];
  }
}

export function validateTemplateContent(
  type: TemplateType,
  content: string
): TemplateValidationError[] {
  if (type === 'json') {
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      return [{ message: (error as Error).message || 'Invalid JSON' }];
    }
    if (parsed && Array.isArray(parsed.steps)) {
      return validateScenarioTemplate(parsed);
    }
    return validateJsonTestSpec(parsed);
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch (error) {
    return [{ message: (error as Error).message || 'Invalid JSON' }];
  }

  if (!parsed) {
    return [{ message: 'Python template content must be a JSON object.' }];
  }

  return validatePythonTemplate(parsed);
}
