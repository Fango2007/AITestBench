import fs from 'fs';
import path from 'path';

import { type ErrorObject, type ValidateFunction } from 'ajv';
import { Ajv2020 } from 'ajv/dist/2020.js';

export interface SchemaValidationIssue {
  message: string;
  path?: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addFormat('date-time', true);
const validators = new Map<string, ValidateFunction>();

function formatAjvErrors(errors: ErrorObject[] | null | undefined): SchemaValidationIssue[] {
  if (!errors) {
    return [];
  }
  return errors.map((error) => {
    const missing = (error.params as { missingProperty?: string }).missingProperty;
    const pathValue = missing ? `${error.instancePath}/${missing}` : error.instancePath || undefined;
    const pathLabel = pathValue ? pathValue.replace(/^\//, '') : undefined;
    return {
      message: error.message ?? 'Schema validation error',
      path: pathLabel
    };
  });
}

function loadValidator(schemaPath: string): ValidateFunction {
  const cached = validators.get(schemaPath);
  if (cached) {
    return cached;
  }
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(raw) as Record<string, unknown>;
  const validator = ajv.compile(schema);
  validators.set(schemaPath, validator);
  return validator;
}

export function validateWithSchema(
  schemaPath: string,
  data: unknown
): { ok: true } | { ok: false; issues: SchemaValidationIssue[] } {
  const resolved = path.resolve(schemaPath);
  const validator = loadValidator(resolved);
  const valid = validator(data);
  if (valid) {
    return { ok: true };
  }
  return { ok: false, issues: formatAjvErrors(validator.errors) };
}
