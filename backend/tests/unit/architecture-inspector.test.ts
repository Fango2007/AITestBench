import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DATA_DIR, ArchitectureTree, sanitizeModelId, readCachedTree } from '../../src/adapters/architecture-inspector.js';

// Minimal valid ArchitectureTree fixture
const validTree: ArchitectureTree = {
  schema_version: '1.0.0',
  model_id: 'meta-llama/Llama-3.1-8B',
  format: 'transformers',
  summary: {
    total_parameters: 8000,
    trainable_parameters: 8000,
    non_trainable_parameters: 0,
    by_type: [{ type: 'Linear', count: 2, parameters: 8000 }],
  },
  root: {
    name: '',
    type: 'LlamaForCausalLM',
    parameters: 0,
    trainable: true,
    shape: null,
    children: [],
  },
  inspected_at: '2026-04-30T00:00:00.000Z',
};

describe('sanitizeModelId', () => {
  it('converts / to --', () => {
    expect(sanitizeModelId('meta-llama/Llama-3.1-8B')).toBe('meta-llama--Llama-3.1-8B');
  });

  it('trims leading/trailing whitespace', () => {
    expect(sanitizeModelId('  mymodel  ')).toBe('mymodel');
  });

  it('rejects path traversal with ..', () => {
    expect(() => sanitizeModelId('../etc/passwd')).toThrow();
  });

  it('rejects path traversal with deeply nested ..', () => {
    expect(() => sanitizeModelId('../../etc/shadow')).toThrow();
  });

  it('rejects path traversal with -- prefix that resolves to ..', () => {
    expect(() => sanitizeModelId('a/../b')).toThrow();
  });

  it('rejects Windows reserved name CON', () => {
    expect(() => sanitizeModelId('CON')).toThrow();
  });

  it('rejects Windows reserved name NUL', () => {
    expect(() => sanitizeModelId('NUL')).toThrow();
  });

  it('rejects Windows reserved name PRN', () => {
    expect(() => sanitizeModelId('PRN')).toThrow();
  });

  it('rejects Windows reserved name AUX', () => {
    expect(() => sanitizeModelId('AUX')).toThrow();
  });

  it('rejects Windows reserved name COM1', () => {
    expect(() => sanitizeModelId('COM1')).toThrow();
  });

  it('rejects Windows reserved name LPT9', () => {
    expect(() => sanitizeModelId('LPT9')).toThrow();
  });

  it('rejects leading dot', () => {
    expect(() => sanitizeModelId('.hidden')).toThrow();
  });

  it('rejects control characters', () => {
    expect(() => sanitizeModelId('valid\x00name')).toThrow();
  });

  it('rejects model_id longer than 255 characters', () => {
    expect(() => sanitizeModelId('a'.repeat(256))).toThrow();
  });

  it('accepts exactly 255 characters', () => {
    const id = 'a'.repeat(255);
    expect(sanitizeModelId(id)).toBe(id);
  });

  it('accepts valid HF-style org/model IDs', () => {
    expect(sanitizeModelId('meta-llama/Llama-3.1-8B')).toBe('meta-llama--Llama-3.1-8B');
    expect(sanitizeModelId('mistralai/Mistral-7B-v0.3')).toBe('mistralai--Mistral-7B-v0.3');
  });

  it('accepts simple model IDs without slash', () => {
    expect(sanitizeModelId('llama3')).toBe('llama3');
  });
});

describe('readCachedTree', () => {
  let tmpDir: string;
  let originalDataDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeLayerTree(sanitizedId: string, content: string): void {
    const dir = path.join(DATA_DIR, sanitizedId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'layer-tree.json'), content, 'utf8');
  }

  function cleanupModel(sanitizedId: string): void {
    const dir = path.join(DATA_DIR, sanitizedId);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  it('returns not_cached when no cache file exists', () => {
    const result = readCachedTree('nonexistent-model-xyz-test-123');
    expect(result).toEqual({ code: 'not_cached' });
  });

  it('returns not_cached and deletes corrupt JSON', () => {
    const sanitizedId = 'test-corrupt-json-xyz';
    writeLayerTree(sanitizedId, '{ not valid json }');
    try {
      const result = readCachedTree(sanitizedId);
      expect(result).toEqual({ code: 'not_cached' });
      // File should have been deleted
      expect(fs.existsSync(path.join(DATA_DIR, sanitizedId, 'layer-tree.json'))).toBe(false);
    } finally {
      cleanupModel(sanitizedId);
    }
  });

  it('returns not_cached and deletes file with wrong schema_version', () => {
    const sanitizedId = 'test-wrong-version-xyz';
    writeLayerTree(sanitizedId, JSON.stringify({ ...validTree, schema_version: '2.0.0' }));
    try {
      const result = readCachedTree(sanitizedId);
      expect(result).toEqual({ code: 'not_cached' });
      expect(fs.existsSync(path.join(DATA_DIR, sanitizedId, 'layer-tree.json'))).toBe(false);
    } finally {
      cleanupModel(sanitizedId);
    }
  });

  it('returns valid ArchitectureTree for a correct cache file', () => {
    const sanitizedId = 'test-valid-cache-xyz';
    writeLayerTree(sanitizedId, JSON.stringify(validTree));
    try {
      const result = readCachedTree(sanitizedId);
      expect((result as ArchitectureTree).schema_version).toBe('1.0.0');
      expect((result as ArchitectureTree).model_id).toBe('meta-llama/Llama-3.1-8B');
    } finally {
      cleanupModel(sanitizedId);
    }
  });
});
