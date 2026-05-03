import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DATA_DIR,
  ArchitectureTree,
  inspectorFailureMessage,
  parseStructuredInspectorError,
  readCachedTree,
  sanitizeModelId,
  scrubInspectionStderr,
} from '../../src/adapters/architecture-inspector.js';

// Minimal valid ArchitectureTree fixture
const validTree: ArchitectureTree = {
  schema_version: '1.0.0',
  model_id: 'meta-llama/Llama-3.1-8B',
  format: 'transformers',
  inspection_method: 'transformers_exact',
  accuracy: 'exact',
  warnings: [],
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

  it('returns not_cached and deletes file missing required schema fields', () => {
    const sanitizedId = 'test-missing-required-fields-xyz';
    writeLayerTree(sanitizedId, JSON.stringify({ schema_version: '1.0.0' }));
    try {
      const result = readCachedTree(sanitizedId);
      expect(result).toEqual({ code: 'not_cached' });
      expect(fs.existsSync(path.join(DATA_DIR, sanitizedId, 'layer-tree.json'))).toBe(false);
    } finally {
      cleanupModel(sanitizedId);
    }
  });

  it('returns not_cached and deletes file with malformed layer nodes', () => {
    const sanitizedId = 'test-malformed-layer-node-xyz';
    writeLayerTree(
      sanitizedId,
      JSON.stringify({
        ...validTree,
        root: {
          ...validTree.root,
          parameters: -1,
        },
      })
    );
    try {
      const result = readCachedTree(sanitizedId);
      expect(result).toEqual({ code: 'not_cached' });
      expect(fs.existsSync(path.join(DATA_DIR, sanitizedId, 'layer-tree.json'))).toBe(false);
    } finally {
      cleanupModel(sanitizedId);
    }
  });

  it('returns not_cached and deletes stale zero-root cache entries without provenance', () => {
    const sanitizedId = 'test-stale-zero-root-cache-xyz';
    const staleTree = {
      ...validTree,
      inspection_method: undefined,
      accuracy: undefined,
      summary: { total_parameters: 0, trainable_parameters: 0, non_trainable_parameters: 0, by_type: [] },
      root: { ...validTree.root, children: [] },
    };
    writeLayerTree(sanitizedId, JSON.stringify(staleTree));
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

describe('inspector subprocess errors', () => {
  it('parses structured inspection failures without leaking raw stderr framing', () => {
    expect(parseStructuredInspectorError('{"error": "inspection_failed", "message": "\'ministral3\'"}\n')).toEqual({
      code: 'inspection_failed',
      message: "'ministral3'",
    });
  });

  it('normalizes structured inspection failures with empty messages', () => {
    expect(parseStructuredInspectorError('{"error": "inspection_failed", "message": ""}\n')).toEqual({
      code: 'inspection_failed',
      message: 'Inspection failed',
    });
  });

  it('does not inject redaction markers when no token is configured', () => {
    const stderr = '{"error": "inspection_failed", "message": "\'ministral3\'"}\n';
    expect(scrubInspectionStderr(stderr, '')).toBe(stderr);
  });

  it('redacts configured Hugging Face tokens from subprocess stderr', () => {
    expect(scrubInspectionStderr('token hf_secret appeared', 'hf_secret')).toBe('token [REDACTED] appeared');
  });

  it('reports timeout failures with captured inspector output', () => {
    expect(inspectorFailureMessage({
      stdout: '',
      stderr: 'Retrying config.json download',
      exitCode: 1,
      signal: 'SIGKILL',
      timedOut: true,
    }, '')).toBe('Inspector process timed out after 60 seconds. Last inspector output: Retrying config.json download');
  });

  it('uses stdout as a fallback diagnostic for process failures', () => {
    expect(inspectorFailureMessage({
      stdout: 'late stdout diagnostic',
      stderr: '',
      exitCode: 1,
      signal: null,
      timedOut: false,
    }, '')).toBe('late stdout diagnostic');
  });
});
