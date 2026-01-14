import { describe, expect, it } from 'vitest';

import { validateJsonTestSpec } from '../../src/plugins/json-validator.js';

describe('json test validation', () => {
  it('flags missing fields', () => {
    const errors = validateJsonTestSpec({});
    expect(errors.length).toBeGreaterThan(0);
  });
});
