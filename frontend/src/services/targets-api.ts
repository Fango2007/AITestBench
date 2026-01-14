import { apiDelete, apiGet, apiPost, apiPut } from './api.js';

export interface TargetModelSummary {
  model_id: string;
  source: 'openai' | 'ollama';
  api_model_name: string;
  family?: string | null;
  parameter_count?: string | null;
  quantization?: string | null;
  context_window?: number | null;
  capabilities?: {
    chat?: boolean;
    tools?: boolean;
    vision?: boolean;
  } | null;
  artifacts?: {
    format?: string | null;
    size_bytes?: number | null;
    digest?: string | null;
  } | null;
}

export interface TargetRecord {
  id: string;
  name: string;
  base_url: string;
  auth_type: string | null;
  provider: 'openai' | 'ollama' | 'auto';
  auth_token_ref: string | null;
  default_model: string | null;
  default_params: Record<string, unknown> | null;
  timeouts: Record<string, unknown> | null;
  concurrency_limit: number | null;
  status: 'active' | 'archived';
  connectivity_status: 'pending' | 'ok' | 'failed';
  last_check_at: string | null;
  last_error: string | null;
  models: TargetModelSummary[] | null;
}

export interface TargetInput {
  name: string;
  base_url: string;
  auth_type?: string | null;
  provider?: 'openai' | 'ollama' | 'auto';
  auth_token_ref?: string | null;
  default_model?: string | null;
  default_params?: Record<string, unknown> | null;
  timeouts?: Record<string, unknown> | null;
  concurrency_limit?: number | null;
}

export async function listTargets(status: 'active' | 'archived' | 'all' = 'all'): Promise<TargetRecord[]> {
  const query = status === 'all' ? '' : `?status=${status}`;
  return apiGet<TargetRecord[]>(`/targets${query}`);
}

export async function createTarget(input: TargetInput): Promise<TargetRecord> {
  return apiPost<TargetRecord>('/targets', input);
}

export async function updateTarget(id: string, updates: Partial<TargetInput>): Promise<TargetRecord> {
  return apiPut<TargetRecord>(`/targets/${id}`, updates);
}

export async function archiveTarget(id: string): Promise<TargetRecord> {
  return apiPost<TargetRecord>(`/targets/${id}/archive`, {});
}

export async function deleteTarget(id: string): Promise<void> {
  await apiDelete(`/targets/${id}`);
}

export async function retryConnectivity(id: string): Promise<void> {
  await apiPost(`/targets/${id}/connectivity-check`, {});
}

export async function probeModelContextWindow(targetId: string, modelId: string) {
  return apiPost<{ model: TargetModelSummary }>(
    `/targets/${targetId}/models/${encodeURIComponent(modelId)}/context-probe`,
    {}
  );
}
