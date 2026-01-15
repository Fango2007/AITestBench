import { apiGet } from './api.js';

export type InferenceServerHealth = {
  server_id: string;
  ok: boolean;
  status_code: number | null;
  response_time_ms: number | null;
  checked_at: string;
};

export async function getInferenceServerHealth(): Promise<InferenceServerHealth[]> {
  const response = await apiGet<{ results: InferenceServerHealth[] }>('/inference-servers/health');
  return response.results;
}

export async function getConnectivityConfig(): Promise<{ poll_interval_ms: number }> {
  return apiGet<{ poll_interval_ms: number }>('/system/connectivity-config');
}
