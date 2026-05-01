const BASE_URL =
  (import.meta.env.VITE_AITESTBENCH_API_BASE_URL as string | undefined)
  ?? 'http://localhost:8080';

function reqHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const token = import.meta.env.VITE_AITESTBENCH_API_TOKEN as string | undefined;
  if (token) h['x-api-token'] = token;
  return h;
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
  format: 'transformers' | 'gguf';
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
    const payload = (await response.json()) as Partial<ApiError>;
    return { code: payload.code ?? 'unknown', error: payload.error ?? `Request failed: ${response.status}` };
  } catch {
    return { code: 'unknown', error: `Request failed: ${response.status}` };
  }
}

export async function inspectArchitecture(sid: string, mid: string): Promise<ArchitectureTree> {
  const response = await fetch(archPath(sid, mid), { method: 'POST', headers: reqHeaders() });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return (await response.json()) as ArchitectureTree;
}

export async function getArchitecture(sid: string, mid: string): Promise<ArchitectureTree> {
  const response = await fetch(archPath(sid, mid), { headers: reqHeaders() });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return (await response.json()) as ArchitectureTree;
}

export async function deleteArchitecture(sid: string, mid: string): Promise<void> {
  const response = await fetch(archPath(sid, mid), { method: 'DELETE', headers: reqHeaders() });
  if (!response.ok) {
    throw await parseApiError(response);
  }
}

export async function getSettings(sid: string, mid: string): Promise<ArchitectureSettings> {
  const response = await fetch(archPath(sid, mid, '/settings'), { headers: reqHeaders() });
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
    headers: reqHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await parseApiError(response);
  }
  return (await response.json()) as ArchitectureSettings;
}
