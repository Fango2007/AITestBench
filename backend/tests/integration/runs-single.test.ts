import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';
import { createTargetRecord } from '../../src/services/target-service';
import { upsertTestDefinition } from '../../src/models/test-definition';

describe('runs API', () => {
  it('creates a single run', async () => {
    process.env.LLM_HARNESS_API_TOKEN = 'test-token';
    const app = createServer();
    const target = createTargetRecord({
      name: `local-${Date.now()}`,
      base_url: 'http://localhost:11434'
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
      payload: { target_id: target.id, test_id: 'test-1' }
    });

    expect(response.statusCode).toBe(201);
  });
});
