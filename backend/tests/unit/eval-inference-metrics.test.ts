import { describe, expect, it } from 'vitest';

import { computeEstimatedCost, computeWordCount } from '../../src/services/eval-inference-service.js';

describe('computeWordCount', () => {
  it('counts words by whitespace split', () => {
    expect(computeWordCount('hello world foo')).toBe(3);
  });

  it('handles leading/trailing whitespace', () => {
    expect(computeWordCount('  hello world  ')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(computeWordCount('')).toBe(0);
  });

  it('handles multiple consecutive spaces', () => {
    expect(computeWordCount('a  b   c')).toBe(3);
  });
});

describe('computeEstimatedCost', () => {
  it('computes cost from known token counts and prices', () => {
    // 100 * 0.001 + 50 * 0.002 = 0.1 + 0.1 = 0.2
    const cost = computeEstimatedCost(100, 50, { input: 0.001, output: 0.002 });
    expect(cost).toBeCloseTo(0.2);
  });

  it('returns null when pricing config is absent', () => {
    expect(computeEstimatedCost(100, 50, null)).toBeNull();
  });

  it('returns null when input_tokens is null', () => {
    expect(computeEstimatedCost(null, 50, { input: 0.001, output: 0.002 })).toBeNull();
  });

  it('returns null when output_tokens is null', () => {
    expect(computeEstimatedCost(100, null, { input: 0.001, output: 0.002 })).toBeNull();
  });
});
