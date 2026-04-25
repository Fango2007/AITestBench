import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { validateWithSchema } from '../../src/services/schema-validator.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(moduleDir, '../../src/schemas/eval-prompt.schema.json');

describe('eval-prompt.schema.json', () => {
  it('accepts a valid payload with text only', () => {
    const result = validateWithSchema(SCHEMA_PATH, { text: 'What is the capital of France?' });
    expect(result.ok).toBe(true);
  });

  it('accepts a valid payload with text and tags', () => {
    const result = validateWithSchema(SCHEMA_PATH, {
      text: 'Explain quantum entanglement.',
      tags: ['science', 'physics']
    });
    expect(result.ok).toBe(true);
  });

  it('rejects empty text', () => {
    const result = validateWithSchema(SCHEMA_PATH, { text: '' });
    expect(result.ok).toBe(false);
  });

  it('rejects text exceeding 10,000 chars', () => {
    const result = validateWithSchema(SCHEMA_PATH, { text: 'a'.repeat(10001) });
    expect(result.ok).toBe(false);
  });

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const result = validateWithSchema(SCHEMA_PATH, { text: 'Hello', tags });
    expect(result.ok).toBe(false);
  });

  it('rejects a tag item exceeding 50 chars', () => {
    const result = validateWithSchema(SCHEMA_PATH, {
      text: 'Hello',
      tags: ['a'.repeat(51)]
    });
    expect(result.ok).toBe(false);
  });

  it('rejects missing text field', () => {
    const result = validateWithSchema(SCHEMA_PATH, { tags: ['foo'] });
    expect(result.ok).toBe(false);
  });
});
