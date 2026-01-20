import { describe, expect, it } from 'vitest';

import { validateTemplateContent } from '../../src/services/template-validation.js';

const validJsonTemplate = JSON.stringify(
  {
    id: 'template-1',
    version: '1.0.0',
    name: 'Template 1',
    description: 'Test template',
    protocols: [],
    request: { method: 'POST', path: '/v1/chat/completions', body_template: {} },
    assertions: [],
    metrics: {}
  },
  null,
  2
);

const validPythonTemplate = JSON.stringify(
  {
    kind: 'python_test',
    schema_version: 'v1',
    id: 'python-template-1',
    name: 'Python Template 1',
    version: '1.0.0',
    lifecycle: { status: 'active' },
    python: { module: 'tests.python.sample_test', entrypoint: 'entrypoint' },
    contracts: { requires: [], provides: [] },
    defaults: {},
    outputs: {
      result_schema: 'scenario_result.v1',
      normalised_response: 'response_normalisation.v1'
    }
  },
  null,
  2
);

describe('template validation', () => {
  it('accepts valid JSON templates', () => {
    const issues = validateTemplateContent('json', validJsonTemplate);
    expect(issues).toHaveLength(0);
  });

  it('accepts valid Python templates', () => {
    const issues = validateTemplateContent('python', validPythonTemplate);
    expect(issues).toHaveLength(0);
  });

  it('rejects invalid JSON templates', () => {
    const issues = validateTemplateContent('json', '{not json}');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('rejects invalid Python templates', () => {
    const issues = validateTemplateContent('python', '{"kind":"python_test"}');
    expect(issues.length).toBeGreaterThan(0);
  });
});
