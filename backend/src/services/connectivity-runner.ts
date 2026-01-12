import { TargetRecord, TargetModelSummary } from '../models/target.js';
import { nowIso } from '../models/repositories.js';
import { fetchTarget, fetchTargets, updateTargetConnectivity } from './targets-repository.js';

interface ConnectivityResult {
  status: 'ok' | 'failed';
  models: TargetModelSummary[];
  error?: string | null;
}

function logDebug(message: string, details?: Record<string, unknown>): void {
  if (process.env.CONNECTIVITY_DEBUG !== '1') {
    return;
  }
  if (details) {
    console.info(`[connectivity-debug] ${message}`, details);
  } else {
    console.info(`[connectivity-debug] ${message}`);
  }
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

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function fetchOpenAIModels(target: TargetRecord): Promise<TargetModelSummary[]> {
  const url = `${normalizeBaseUrl(target.base_url)}/v1/models`;
  logDebug('Fetching OpenAI models', { targetId: target.id, url });
  const response = await fetch(url, {
    headers: buildHeaders(target)
  });
  if (!response.ok) {
    throw new Error(`OpenAI models request failed (${response.status})`);
  }
  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  const host = new URL(target.base_url).host;
  return (payload.data ?? []).map((model) => ({
    id: model.id,
    name: model.id,
    provider: host
  }));
}

async function fetchOllamaModels(target: TargetRecord): Promise<TargetModelSummary[]> {
  const url = `${normalizeBaseUrl(target.base_url)}/api/tags`;
  logDebug('Fetching Ollama tags', { targetId: target.id, url });
  const response = await fetch(url, {
    headers: buildHeaders(target)
  });
  if (!response.ok) {
    throw new Error(`Ollama tags request failed (${response.status})`);
  }
  const payload = (await response.json()) as { models?: Array<{ name: string; version?: string }> };
  const host = new URL(target.base_url).host;
  return (payload.models ?? []).map((model) => ({
    name: model.name,
    provider: host,
    version: model.version ?? null
  }));
}

function dedupeModels(models: TargetModelSummary[]): TargetModelSummary[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = `${model.provider ?? ''}:${model.name}:${model.version ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeModelsByName(models: TargetModelSummary[]): TargetModelSummary[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = `${model.name}:${model.version ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function runConnectivityCheck(target: TargetRecord): Promise<ConnectivityResult> {
  try {
    logDebug('Running connectivity check', {
      targetId: target.id,
      name: target.name,
      baseUrl: target.base_url,
      provider: target.provider
    });
    if (target.provider === 'auto') {
      const results = await Promise.allSettled([
        fetchOpenAIModels(target),
        fetchOllamaModels(target)
      ]);
      const models: TargetModelSummary[] = [];
      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          models.push(...result.value);
        } else {
          const label = index === 0 ? 'OpenAI' : 'Ollama';
          errors.push(`${label}: ${result.reason instanceof Error ? result.reason.message : 'failed'}`);
        }
      });
      if (models.length > 0) {
        return { status: 'ok', models: dedupeModelsByName(models) };
      }
      return {
        status: 'failed',
        models: [],
        error: errors.join(' | ') || 'Connectivity check failed'
      };
    }

    const models =
      target.provider === 'ollama'
        ? await fetchOllamaModels(target)
        : await fetchOpenAIModels(target);
    return { status: 'ok', models };
  } catch (error) {
    logDebug('Connectivity check threw', {
      targetId: target.id,
      error: error instanceof Error ? error.message : String(error)
    });
    const message = error instanceof Error ? error.message : 'Connectivity check failed';
    return { status: 'failed', models: [], error: message };
  }
}

export function queueConnectivityCheck(targetId: string): void {
  setTimeout(async () => {
    const target = fetchTarget(targetId);
    if (!target) {
      logDebug('Target missing for connectivity check', { targetId });
      return;
    }

    logDebug('Queued connectivity check', {
      targetId: target.id,
      name: target.name,
      baseUrl: target.base_url,
      provider: target.provider
    });
    updateTargetConnectivity(target.id, {
      connectivity_status: 'pending',
      last_check_at: nowIso(),
      last_error: null,
      models: target.models ?? null
    });

    const result = await runConnectivityCheck(target);
    updateTargetConnectivity(target.id, {
      connectivity_status: result.status,
      last_check_at: nowIso(),
      last_error: result.error ?? null,
      models: result.models
    });
    const outcome = result.status === 'ok' ? 'succeeded' : 'failed';
    if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
      console.info(`[connectivity-check] ${target.name} ${outcome}`);
    }
  }, 0);
}

export function startConnectivityMonitor(): void {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return;
  }
  const intervalMs = Number(process.env.CONNECTIVITY_POLL_INTERVAL_MS ?? 30000);
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 30000;
  setInterval(() => {
    const targets = fetchTargets('active');
    targets.forEach((target) => queueConnectivityCheck(target.id));
  }, safeIntervalMs);
}
