export interface MetricResult {
  ttfb_ms?: number | null;
  total_ms?: number | null;
  prefill_ms?: number | null;
  decode_ms?: number | null;
  tokens_per_sec?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  not_measurable?: Record<string, string>;
}

export interface TimingInput {
  request_started_at: number;
  first_token_at?: number | null;
  completed_at?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}

export function computeMetrics(input: TimingInput): MetricResult {
  const metrics: MetricResult = {
    not_measurable: {}
  };

  if (input.first_token_at) {
    metrics.ttfb_ms = input.first_token_at - input.request_started_at;
  }

  if (input.completed_at) {
    metrics.total_ms = input.completed_at - input.request_started_at;
  }

  if (input.first_token_at && input.completed_at) {
    metrics.prefill_ms = input.first_token_at - input.request_started_at;
    metrics.decode_ms = input.completed_at - input.first_token_at;
  } else if (input.completed_at) {
    metrics.prefill_ms = input.completed_at - input.request_started_at;
    metrics.not_measurable = {
      ...metrics.not_measurable,
      decode_ms: 'Token timestamps unavailable'
    };
  }

  if (input.completion_tokens != null && metrics.decode_ms && metrics.decode_ms > 0) {
    metrics.tokens_per_sec = (input.completion_tokens / metrics.decode_ms) * 1000;
  } else if (input.completion_tokens != null) {
    metrics.not_measurable = {
      ...metrics.not_measurable,
      tokens_per_sec: 'Missing decode duration'
    };
  }

  metrics.prompt_tokens = input.prompt_tokens ?? null;
  metrics.completion_tokens = input.completion_tokens ?? null;

  if (!metrics.not_measurable || Object.keys(metrics.not_measurable).length === 0) {
    delete metrics.not_measurable;
  }

  return metrics;
}
