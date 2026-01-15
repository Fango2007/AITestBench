import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server.js';
import { createInferenceServerRecord } from '../../src/services/inference-servers-repository.js';
import { saveSuite } from '../../src/services/suite-service.js';
import { upsertTestDefinition } from '../../src/models/test-definition.js';


describe('suite runs API', () => {
  it('creates a suite run', async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    const app = createServer();
    const server = createInferenceServerRecord({
      inference_server: { display_name: `suite-server-${Date.now()}` },
      endpoints: { base_url: 'http://localhost:11434' },
      runtime: { api: { schema_family: ['openai-compatible'], api_version: null } }
    });
    upsertTestDefinition({
      id: 'suite-test-1',
      version: '1.0.0',
      name: 'Suite Test 1',
      description: 'Basic test',
      category: 'basic',
      tags: [],
      protocols: ['openai_chat_completions'],
      spec_path: 'tests/definitions/suite-test-1.json',
      runner_type: 'json',
      request_template: {},
      assertions: [],
      metric_rules: {}
    });
    saveSuite({ id: 'suite-1', name: 'Suite 1', ordered_test_ids: ['suite-test-1'] });

    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { 'x-api-token': 'test-token' },
      payload: { inference_server_id: server.inference_server.server_id, suite_id: 'suite-1' }
    });

    expect(response.statusCode).toBe(201);
  });
});
