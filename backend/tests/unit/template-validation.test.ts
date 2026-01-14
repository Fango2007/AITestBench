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

describe('template validation', () => {
  it('accepts valid JSON templates', () => {
    const issues = validateTemplateContent('json', validJsonTemplate);
    expect(issues).toHaveLength(0);
  });

  it('rejects invalid JSON templates', () => {
    const issues = validateTemplateContent('json', '{not json}');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('rejects empty Python templates', () => {
    const issues = validateTemplateContent('python', '   ');
    expect(issues.length).toBeGreaterThan(0);
  });
});
