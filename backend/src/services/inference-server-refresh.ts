import os from 'os';

import { InferenceServerRecord } from '../models/inference-server.js';
import { nowIso } from '../models/repositories.js';
import { updateInferenceServerRecord } from './inference-servers-repository.js';

export class InferenceServerRefreshError extends Error {
  details: {
    server_id: string;
    attempted_url: string;
    status_code?: number;
    message?: string;
    timestamp: string;
  };

  constructor(details: {
    server_id: string;
    attempted_url: string;
    status_code?: number;
    message?: string;
    timestamp: string;
  }) {
    super(details.message ?? 'Inference server refresh failed');
    this.name = 'InferenceServerRefreshError';
    this.details = details;
  }
}

function parseOsName(platform: string): 'macos' | 'linux' | 'windows' | 'unknown' {
  if (platform === 'darwin') {
    return 'macos';
  }
  if (platform === 'win32') {
    return 'windows';
  }
  if (platform === 'linux') {
    return 'linux';
  }
  return 'unknown';
}

function parseOsArch(arch: string): 'arm64' | 'x86_64' | 'unknown' {
  if (arch === 'arm64') {
    return 'arm64';
  }
  if (arch === 'x64') {
    return 'x86_64';
  }
  return 'unknown';
}

function buildAuthHeaders(server: InferenceServerRecord): Record<string, string> {
  const headers: Record<string, string> = {};
  const tokenEnv = server.auth.token_env;
  const token = tokenEnv ? process.env[tokenEnv] : null;
  if (!token) {
    return headers;
  }
  const headerName = server.auth.header_name || 'Authorization';
  if (server.auth.type === 'none') {
    return headers;
  }
  if (server.auth.type === 'bearer' || server.auth.type === 'oauth') {
    headers[headerName] = `Bearer ${token}`;
    return headers;
  }
  if (server.auth.type === 'basic') {
    headers[headerName] = `Basic ${token}`;
    return headers;
  }
  headers[headerName] = token;
  return headers;
}

export function refreshRuntime(server: InferenceServerRecord): InferenceServerRecord | null {
  const cpuInfo = os.cpus() ?? [];
  const cpuModel = cpuInfo[0]?.model ?? null;
  const cpuCores = cpuInfo.length ? cpuInfo.length : null;
  const updated = updateInferenceServerRecord(server.inference_server.server_id, {
    runtime: {
      ...server.runtime,
      retrieved_at: nowIso(),
      source: 'client',
      platform: {
        os: { name: parseOsName(os.platform()), version: os.release() ?? null, arch: parseOsArch(os.arch()) },
        container: server.runtime.platform.container
      },
      hardware: {
        ...server.runtime.hardware,
        cpu: { model: cpuModel, cores: cpuCores },
        ram_mb: Math.round(os.totalmem() / (1024 * 1024))
      }
    }
  });
  return updated;
}

function normalizeOpenAiModels(payload: Record<string, unknown>) {
  const entries = Array.isArray(payload.data) ? payload.data : [];
  return entries
    .map((entry) => ({
      model_id: typeof entry.id === 'string' ? entry.id : '',
      display_name: typeof entry.id === 'string' ? entry.id : null,
      context_window_tokens: null,
      quantisation: null
    }))
    .filter((entry) => entry.model_id);
}

function normalizeOllamaModels(payload: Record<string, unknown>) {
  const entries = Array.isArray(payload.models) ? payload.models : [];
  return entries
    .map((entry) => {
      const name = typeof entry.name === 'string' ? entry.name : '';
      const details = (entry.details as Record<string, unknown>) ?? {};
      return {
        model_id: name,
        display_name: name || null,
        context_window_tokens:
          typeof details.context_length === 'number' ? details.context_length : null,
        quantisation: typeof details.quantization === 'string' ? details.quantization : null
      };
    })
    .filter((entry) => entry.model_id);
}

export async function refreshDiscovery(server: InferenceServerRecord): Promise<InferenceServerRecord> {
  const schemaFamilies = Array.isArray(server.runtime.api.schema_family)
    ? server.runtime.api.schema_family
    : [server.runtime.api.schema_family];
  const supportedFamilies = schemaFamilies.filter((family) => family !== 'custom');
  if (supportedFamilies.length === 0) {
    throw new InferenceServerRefreshError({
      server_id: server.inference_server.server_id,
      attempted_url: server.endpoints.base_url,
      message: 'Discovery not supported for custom schema_family',
      timestamp: nowIso()
    });
  }

  const authHeaders = buildAuthHeaders(server);
  const rawPayloads: Record<string, unknown> = {};
  const modelMap = new Map<string, { model_id: string; display_name: string | null; context_window_tokens: number | null; quantisation: string | null }>();
  const errors: string[] = [];

  for (const schemaFamily of supportedFamilies) {
    const path = schemaFamily === 'openai-compatible' ? '/v1/models' : '/api/tags';
    const url = new URL(path, server.endpoints.base_url).toString();
    let response: Response;
    try {
      response = await fetch(url, { headers: authHeaders });
    } catch (error) {
      errors.push(`${schemaFamily}: ${error instanceof Error ? error.message : 'Network error'}`);
      continue;
    }

    if (!response.ok) {
      errors.push(`${schemaFamily}: status ${response.status}`);
      continue;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      const body = await response.text();
      errors.push(`${schemaFamily}: expected JSON but received ${contentType || 'unknown'} (${body.slice(0, 200)})`);
      continue;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    rawPayloads[schemaFamily] = payload;
    const normalised = schemaFamily === 'openai-compatible'
      ? normalizeOpenAiModels(payload)
      : normalizeOllamaModels(payload);
    for (const entry of normalised) {
      if (!modelMap.has(entry.model_id)) {
        modelMap.set(entry.model_id, entry);
      }
    }
  }

  if (modelMap.size === 0) {
    throw new InferenceServerRefreshError({
      server_id: server.inference_server.server_id,
      attempted_url: server.endpoints.base_url,
      message: `Discovery request failed for ${supportedFamilies.join(', ')}${errors.length ? ` (${errors.join('; ')})` : ''}`,
      timestamp: nowIso()
    });
  }

  const normalised = Array.from(modelMap.values());
  const payload =
    supportedFamilies.length === 1 ? (rawPayloads[supportedFamilies[0]] as Record<string, unknown>) : rawPayloads;
  const updated = updateInferenceServerRecord(server.inference_server.server_id, {
    discovery: {
      retrieved_at: nowIso(),
      ttl_seconds: server.discovery.ttl_seconds,
      model_list: {
        raw: payload,
        normalised
      }
    }
  });
  if (!updated) {
    throw new InferenceServerRefreshError({
      server_id: server.inference_server.server_id,
      attempted_url: url,
      message: 'Unable to persist discovery response',
      timestamp: nowIso()
    });
  }
  return updated;
}
