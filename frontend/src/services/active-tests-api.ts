import { apiDelete, apiGet, apiPost } from './api.js';

export interface ActiveTestRecord {
  id: string;
  template_id: string;
  template_version: string;
  inference_server_id: string;
  model_name: string;
  status: string;
  created_at: string;
  deleted_at?: string | null;
  version: string;
  command_preview?: string | null;
  python_ready?: boolean;
}

export async function listActiveTests(): Promise<ActiveTestRecord[]> {
  return apiGet<ActiveTestRecord[]>('/active-tests');
}

export async function instantiateActiveTests(payload: {
  inference_server_id: string;
  model_name: string;
  template_ids: string[];
  param_overrides?: Record<string, unknown>;
}): Promise<ActiveTestRecord[]> {
  return apiPost<ActiveTestRecord[]>('/active-tests/instantiate', payload);
}

export async function deleteActiveTest(id: string): Promise<void> {
  await apiDelete(`/active-tests/${id}`);
}
