import { describe, expect, it } from 'vitest';

import { evaluateCompliance } from '../../src/services/compliance';

describe('evaluateCompliance', () => {
  it('flags missing required fields', () => {
    const report = evaluateCompliance({ response: {} });
    expect(report.status).toBe('fail');
    expect(report.findings.length).toBeGreaterThan(0);
  });
});
