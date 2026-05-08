import { describe, expect, it } from 'vitest';

import { InferenceServerRecord } from '../../src/models/inference-server.js';
import { buildInferenceServerAuthHeaders } from '../../src/services/inference-server-auth.js';

function server(auth: InferenceServerRecord['auth']): InferenceServerRecord {
  return { auth } as InferenceServerRecord;
}

describe('inference server auth headers', () => {
  it('uses a stored raw bearer token before token_env fallback', () => {
    process.env.CATALOG_TEST_TOKEN = 'from-env';
    const headers = buildInferenceServerAuthHeaders(server({
      type: 'bearer',
      header_name: 'Authorization',
      token: 'from-record',
      token_env: 'CATALOG_TEST_TOKEN'
    }));
    expect(headers).toEqual({ Authorization: 'Bearer from-record' });
  });

  it('falls back to token_env when no raw token is stored', () => {
    process.env.CATALOG_TEST_TOKEN = 'from-env';
    const headers = buildInferenceServerAuthHeaders(server({
      type: 'custom',
      header_name: 'X-API-Key',
      token: null,
      token_env: 'CATALOG_TEST_TOKEN'
    }));
    expect(headers).toEqual({ 'X-API-Key': 'from-env' });
  });

  it('does not send auth headers for auth type none', () => {
    const headers = buildInferenceServerAuthHeaders(server({
      type: 'none',
      header_name: 'Authorization',
      token: 'ignored',
      token_env: null
    }));
    expect(headers).toEqual({});
  });
});
