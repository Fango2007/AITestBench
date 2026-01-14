import { validateJsonTestSpec } from '../plugins/json-validator.js';

export type TemplateType = 'json' | 'python';

export interface TemplateValidationError {
  message: string;
  path?: string;
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
    return validateJsonTestSpec(parsed);
  }

  if (!content.trim()) {
    return [{ message: 'Python template content must not be empty.' }];
  }

  return [];
}
