import { TargetRecord, TargetModelSummary } from '../models/target.js';

const CONTEXT_THRESHOLDS = [4076, 8192, 32768, 128000, 262144];

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildHeaders(target: TargetRecord): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };
  if (target.auth_token_ref) {
    const token = process.env[target.auth_token_ref];
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

function buildPrompt(tokens: number): string {
  return 'token '.repeat(tokens).trim();
}

export async function probeContextWindow(
  target: TargetRecord,
  model: TargetModelSummary
): Promise<number | null> {
  const url = `${normalizeBaseUrl(target.base_url)}/v1/chat/completions`;
  let lastSuccess: number | null = null;

  for (const threshold of CONTEXT_THRESHOLDS) {
    const body = {
      model: model.api_model_name,
      messages: [{ role: 'user', content: buildPrompt(threshold) }],
      max_completion_tokens: 1,
      stream: false
    };
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(target),
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        break;
      }
      lastSuccess = threshold;
    } catch {
      break;
    }
  }

  return lastSuccess;
}
