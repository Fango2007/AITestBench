import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { createInferenceServerRecord } from '../../src/services/inference-servers-repository.js';
import { upsertTestDefinition } from '../../src/models/test-definition.js';

describe('runs API', () => {
  it('creates a single run', async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    const app = createServer();
    const server = createInferenceServerRecord({
      inference_server: { display_name: `local-${Date.now()}` },
      endpoints: { base_url: 'http://localhost:11434' },
      runtime: { api: { schema_family: ['openai-compatible'], api_version: null } }
    });
    upsertTestDefinition({
      id: 'test-1',
      version: '1.0.0',
      name: 'Test 1',
      description: 'Basic test',
      category: 'basic',
      tags: [],
      protocols: ['openai_chat_completions'],
      spec_path: 'tests/definitions/test-1.json',
      runner_type: 'json',
      request_template: {},
      assertions: [],
      metric_rules: {}
    });
    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { 'x-api-token': 'test-token' },
      payload: { inference_server_id: server.inference_server.server_id, test_id: 'test-1' }
    });

    expect(response.statusCode).toBe(201);
  });
});
