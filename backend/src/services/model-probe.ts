import { TargetRecord, TargetModelSummary } from '../models/target.js';

const CONTEXT_THRESHOLDS = [4076, 8192, 32768, 128000, 262144];
const DEFAULT_TIMEOUT_MS = 600000;

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
): Promise<{ contextWindow: number | null; reason?: string }>{
  const url = `${normalizeBaseUrl(target.base_url)}/v1/chat/completions`;
  const modelName = model.api_model_name || model.model_id;
  let lastSuccess: number | null = null;

  for (const threshold of CONTEXT_THRESHOLDS) {
    const body = {
      model: modelName,
      messages: [{ role: 'user', content: buildPrompt(threshold) }],
      max_completion_tokens: 1,
      stream: false
    };
    try {
      const controller = new AbortController();
      const timeoutMs = Number(process.env.AITESTBENCH_CONTEXT_PROBE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
      const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
      const timeout = setTimeout(() => controller.abort(), safeTimeoutMs);
      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(target),
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) {
        let reason: string | undefined;
        try {
          const payload = (await response.json()) as { error?: { message?: string } };
          reason = payload.error?.message;
        } catch {
          const text = await response.text();
          reason = text || undefined;
        }
        return { contextWindow: lastSuccess, reason };
      }
      lastSuccess = threshold;
    } catch {
      return { contextWindow: lastSuccess, reason: 'Probe request failed.' };
    }
  }

  return { contextWindow: lastSuccess };
}
