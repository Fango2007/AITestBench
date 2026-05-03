import { beforeEach, expect, test, vi } from 'vitest';

import { inspectArchitecture, patchSettings } from '../../src/services/architecture-api.js';

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function tree() {
  return {
    schema_version: '1.0.0',
    model_id: 'org/model',
    format: 'mlx',
    inspection_method: 'config_fallback',
    accuracy: 'estimated',
    warnings: ['estimated from config'],
    summary: {
      total_parameters: 0,
      trainable_parameters: 0,
      non_trainable_parameters: 0,
      by_type: [],
    },
    root: {
      name: '',
      type: 'Model',
      parameters: 0,
      trainable: false,
      shape: null,
      children: [],
    },
    inspected_at: '2026-05-02T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

test('inspectArchitecture sends a bodyless POST without JSON content-type', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(tree()));
  vi.stubGlobal('fetch', fetchMock);

  await inspectArchitecture('server-1', 'org/model');

  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(init.method).toBe('POST');
  expect(init.body).toBeUndefined();
  expect(init.headers).not.toHaveProperty('content-type');
});

test('inspectArchitecture preserves provenance metadata from estimated trees', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(tree()));
  vi.stubGlobal('fetch', fetchMock);

  const result = await inspectArchitecture('server-1', 'org/model');

  expect(result.inspection_method).toBe('config_fallback');
  expect(result.accuracy).toBe('estimated');
  expect(result.warnings).toContain('estimated from config');
});

test('inspectArchitecture preserves backend message fields on errors', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ code: 'inspection_failed', message: 'Failed to read MLX config.json: network error' }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);

  await expect(inspectArchitecture('server-1', 'org/model')).rejects.toEqual({
    code: 'inspection_failed',
    error: 'Failed to read MLX config.json: network error',
  });
});

test('inspectArchitecture falls back to HTTP status when error payload is empty', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ code: '', error: '' }),
  } as Response);
  vi.stubGlobal('fetch', fetchMock);

  await expect(inspectArchitecture('server-1', 'org/model')).rejects.toEqual({
    code: 'unknown',
    error: 'Request failed: 500',
  });
});

test('patchSettings keeps JSON content-type because it sends a JSON body', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ trust_remote_code: true }));
  vi.stubGlobal('fetch', fetchMock);

  await patchSettings('server-1', 'org/model', { trust_remote_code: true });

  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(init.method).toBe('PATCH');
  expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  expect(init.body).toBe(JSON.stringify({ trust_remote_code: true }));
});
