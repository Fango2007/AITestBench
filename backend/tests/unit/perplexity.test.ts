import { describe, expect, it } from 'vitest';

import { computeProxyPerplexity } from '../../src/services/perplexity-runner';

describe('proxy perplexity', () => {
  it('computes accuracy', () => {
    const result = computeProxyPerplexity([
      { prompt: 'a', options: ['a', 'b'], correct: 'a' },
      { prompt: 'b', options: ['a', 'b'], correct: 'b' }
    ]);

    expect(result.accuracy).toBe(1);
  });
});
