import { describe, expect, it } from 'vitest';

import { computeMetrics } from '../../src/services/metrics';

describe('computeMetrics', () => {
  it('marks decode duration as not measurable without token timestamps', () => {
    const metrics = computeMetrics({
      request_started_at: 0,
      completed_at: 1000,
      completion_tokens: 100
    });

    expect(metrics.prefill_ms).toBe(1000);
    expect(metrics.not_measurable?.decode_ms).toBe('Token timestamps unavailable');
  });

  it('computes tokens per second when decode duration exists', () => {
    const metrics = computeMetrics({
      request_started_at: 0,
      first_token_at: 100,
      completed_at: 1100,
      completion_tokens: 100
    });

    expect(metrics.decode_ms).toBe(1000);
    expect(metrics.tokens_per_sec).toBeCloseTo(100);
  });
});
