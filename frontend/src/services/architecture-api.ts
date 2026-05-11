const BASE_URL =
  (import.meta.env.VITE_INFERHARNESS_API_BASE_URL as string | undefined)
  ?? 'http://localhost:8080';

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const token = import.meta.env.VITE_INFERHARNESS_API_TOKEN as string | undefined;
  if (token) h['x-api-token'] = token;
  return h;
}

function jsonHeaders(): Record<string, string> {
  return { ...authHeaders(), 'content-type': 'application/json' };
}

export interface ArchitectureLayerNode {
  name: string;
  type: string;
  parameters: number;
  trainable: boolean;
  shape: number[] | null;
  children: ArchitectureLayerNode[];
}

export interface ArchitectureSummary {
  total_parameters: number;
  trainable_parameters: number;
  non_trainable_parameters: number;
  by_type: Array<{ type: string; count: number; parameters: number }>;
}

export interface ArchitectureTree {
  schema_version: '1.0.0';
  model_id: string;
  format: 'transformers' | 'gguf' | 'mlx' | 'gptq' | 'awq' | 'safetensors';
  inspection_method?: 'transformers_exact' | 'config_fallback' | 'gguf_header' | 'safetensors_header' | 'hybrid';
  accuracy?: 'exact' | 'estimated';
  warnings?: string[];
  summary: ArchitectureSummary;
  root: ArchitectureLayerNode;
  inspected_at: string;
}

export interface ArchitectureSettings {
  trust_remote_code: boolean;
}

export interface ApiError {
  code: string;
  error: string;
}

function archPath(sid: string, mid: string, suffix = ''): string {
  return `${BASE_URL}/models/${encodeURIComponent(sid)}/${encodeURIComponent(mid)}/architecture${suffix}`;
}

async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as Partial<ApiError> & { message?: string; detail?: string };
    const error = firstNonEmptyString(payload.error, payload.message, payload.detail, `Request failed: ${response.status}`);
    return { code: firstNonEmptyString(payload.code, 'unknown'), error };
  } catch {
    return { code: 'unknown', error: `Request failed: ${response.status}` };
  }
}

function firstNonEmptyString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return 'Request failed';
}

export async function inspectArchitecture(sid: string, mid: string): Promise<ArchitectureTree> {
  const response = await fetch(archPath(sid, mid), { method: 'POST', headers: authHeaders() });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return (await response.json()) as ArchitectureTree;
}

export async function getArchitecture(sid: string, mid: string): Promise<ArchitectureTree> {
  const response = await fetch(archPath(sid, mid), { headers: authHeaders() });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return (await response.json()) as ArchitectureTree;
}

export async function deleteArchitecture(sid: string, mid: string): Promise<void> {
  const response = await fetch(archPath(sid, mid), { method: 'DELETE', headers: authHeaders() });
  if (!response.ok) {
    throw await parseApiError(response);
  }
}

export async function getSettings(sid: string, mid: string): Promise<ArchitectureSettings> {
  const response = await fetch(archPath(sid, mid, '/settings'), { headers: authHeaders() });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return (await response.json()) as ArchitectureSettings;
}

export async function patchSettings(
  sid: string,
  mid: string,
  body: Partial<ArchitectureSettings>
): Promise<ArchitectureSettings> {
  const response = await fetch(archPath(sid, mid, '/settings'), {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return (await response.json()) as ArchitectureSettings;
}
