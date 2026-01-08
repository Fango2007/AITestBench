import { describe, expect, it } from 'vitest';

import { createServer } from '../../src/api/server';
import { createTargetRecord } from '../../src/services/target-service';
import { saveSuite } from '../../src/services/suite-service';
import { upsertTestDefinition } from '../../src/models/test-definition';


describe('suite runs API', () => {
  it('creates a suite run', async () => {
    process.env.AITESTBENCH_API_TOKEN = 'test-token';
    const app = createServer();
    const target = createTargetRecord({
      name: `suite-target-${Date.now()}`,
      base_url: 'http://localhost:11434'
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
      payload: { target_id: target.id, suite_id: 'suite-1' }
    });

    expect(response.statusCode).toBe(201);
  });
});
