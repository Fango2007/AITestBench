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
  return (payload.data ?? []).map((model) => ({
    model_id: model.id,
    source: 'openai',
    api_model_name: model.id,
    family: null,
    parameter_count: null,
    quantization: null,
    context_window: null,
    capabilities: null,
    artifacts: null
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
  const payload = (await response.json()) as {
    models?: Array<{
      name: string;
      model?: string;
      size?: number;
      digest?: string;
      details?: {
        family?: string;
        parameter_size?: string;
        quantization_level?: string;
        format?: string;
      };
      context_length?: number;
      capabilities?: { chat?: boolean; tools?: boolean; vision?: boolean };
    }>;
  };
  return (payload.models ?? []).map((model) => ({
    model_id: model.model ?? model.name,
    source: 'ollama',
    api_model_name: model.name,
    family: model.details?.family ?? null,
    parameter_count: model.details?.parameter_size ?? null,
    quantization: model.details?.quantization_level ?? null,
    context_window: model.context_length ?? null,
    capabilities: model.capabilities ?? null,
    artifacts: {
      format: model.details?.format ?? null,
      size_bytes: model.size ?? null,
      digest: model.digest ?? null
    }
  }));
}

function mergeModels(primary: TargetModelSummary, secondary: TargetModelSummary): TargetModelSummary {
  const preferOllama =
    primary.source === 'ollama' || secondary.source === 'ollama' ? 'ollama' : primary.source;
  return {
    model_id: primary.model_id || secondary.model_id,
    source: preferOllama,
    api_model_name: primary.api_model_name || secondary.api_model_name,
    family: primary.family ?? secondary.family ?? null,
    parameter_count: primary.parameter_count ?? secondary.parameter_count ?? null,
    quantization: primary.quantization ?? secondary.quantization ?? null,
    context_window: primary.context_window ?? secondary.context_window ?? null,
    capabilities: primary.capabilities ?? secondary.capabilities ?? null,
    artifacts: primary.artifacts ?? secondary.artifacts ?? null
  };
}

function mergeModelsByIdentity(models: TargetModelSummary[]): TargetModelSummary[] {
  const map = new Map<string, TargetModelSummary>();
  for (const model of models) {
    const key = model.model_id || model.api_model_name;
    if (!key) {
      continue;
    }
    const existing = map.get(key);
    if (existing) {
      map.set(key, mergeModels(existing, model));
    } else {
      map.set(key, model);
    }
  }
  return Array.from(map.values());
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
        return { status: 'ok', models: mergeModelsByIdentity(models) };
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
    return { status: 'ok', models: mergeModelsByIdentity(models) };
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
