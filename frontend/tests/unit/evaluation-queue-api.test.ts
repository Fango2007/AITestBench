import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isValidQueueScore, skipEvaluationQueueItem, validateQueueScores } from '../../src/services/evaluation-queue-api.js';

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('evaluation queue score helpers', () => {
  it('accepts only integer scores from 1 to 5', () => {
    expect(isValidQueueScore(1)).toBe(true);
    expect(isValidQueueScore(5)).toBe(true);
    expect(isValidQueueScore(0)).toBe(false);
    expect(isValidQueueScore(6)).toBe(false);
    expect(isValidQueueScore(3.5)).toBe(false);
  });

  it('validates the five-score payload', () => {
    expect(validateQueueScores({
      accuracy_score: 5,
      relevance_score: 4,
      coherence_score: 5,
      completeness_score: 4,
      helpfulness_score: 5,
      note: null
    })).toBe(true);
    expect(validateQueueScores({
      accuracy_score: 5,
      relevance_score: 4,
      coherence_score: 9,
      completeness_score: 4,
      helpfulness_score: 5,
      note: null
    })).toBe(false);
  });

  it('treats skip 204 responses as successful', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('204 responses do not have JSON bodies');
      }
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await expect(skipEvaluationQueueItem('queue-result-1')).resolves.toBeUndefined();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ reason: null }));
  });
});
