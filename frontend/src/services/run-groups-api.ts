import { apiGet, apiPost } from './api.js';

export type RunGroupStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface RunGroupResultRecord {
  id: string;
  run_id: string;
  test_id: string;
  verdict: 'pass' | 'fail' | 'skip' | string;
  failure_reason: string | null;
  metrics: Record<string, unknown> | null;
  artefacts: Record<string, unknown> | null;
  raw_events: Record<string, unknown>[] | null;
  repetition_stats: Record<string, unknown> | null;
  started_at: string;
  ended_at: string | null;
}

export interface RunGroupItem {
  id: string;
  group_id: string;
  child_run_id: string;
  inference_server_id: string;
  model_id: string;
  stable_letter: string;
  accent_index: number;
  status: RunGroupStatus;
  failure_reason: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
  run: {
    id: string;
    status: string;
    started_at: string;
    ended_at: string | null;
  } | null;
  results: RunGroupResultRecord[];
}

export interface RunGroupDetail {
  id: string;
  status: RunGroupStatus;
  selected_template_ids: string[];
  test_overrides: Record<string, unknown> | null;
  profile_id: string | null;
  profile_version: string | null;
  created_at: string;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
  items: RunGroupItem[];
}

export interface CreateRunGroupPayload {
  targets: Array<{ inference_server_id: string; model_id: string }>;
  selected_template_ids: string[];
  test_overrides?: Record<string, unknown>;
  profile_id?: string;
  profile_version?: string;
}

export async function createRunGroup(payload: CreateRunGroupPayload): Promise<RunGroupDetail> {
  return apiPost<RunGroupDetail>('/run-groups', payload);
}

export async function getRunGroup(id: string): Promise<RunGroupDetail> {
  return apiGet<RunGroupDetail>(`/run-groups/${id}`);
}

export async function cancelRunGroup(id: string): Promise<RunGroupDetail> {
  return apiPost<RunGroupDetail>(`/run-groups/${id}/cancel`, {});
}
