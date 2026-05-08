import { apiGet } from './api.js';

export interface LeaderboardEntry {
  rank: number;
  model_name: string;
  composite_score: number;
  avg_accuracy: number;
  avg_relevance: number;
  avg_coherence: number;
  avg_completeness: number;
  avg_helpfulness: number;
  avg_total_tokens: number | null;
  avg_latency_ms: number | null;
  avg_estimated_cost: number | null;
  evaluation_count: number;
  score_percent: number;
  pass_rate: number | null;
  group_by: 'model' | 'server' | 'quantization';
  group_key: string;
  group_label: string;
  server_id: string | null;
  server_name: string | null;
  quantization_level: string | null;
  representative_evaluation_id: string | null;
}

export interface LeaderboardResponse {
  filters_applied: {
    date_from: string | null;
    date_to: string | null;
    tags: string[];
    server_ids: string[];
    model_names: string[];
    score_min: number | null;
    score_max: number | null;
    sort_by: string;
    group_by: string;
  };
  entries: LeaderboardEntry[];
}

export interface LeaderboardFilters {
  date_from?: string;
  date_to?: string;
  tags?: string[];
  server_ids?: string[];
  model_names?: string[];
  score_min?: number | null;
  score_max?: number | null;
  sort_by?: 'score' | 'latency' | 'cost' | 'pass_rate';
  group_by?: 'model' | 'server' | 'quantization';
}

export function getLeaderboard(filters: LeaderboardFilters = {}): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  if (filters.server_ids && filters.server_ids.length > 0) params.set('server_ids', filters.server_ids.join(','));
  if (filters.model_names && filters.model_names.length > 0) params.set('model_names', filters.model_names.join(','));
  if (filters.score_min != null) params.set('score_min', String(filters.score_min));
  if (filters.score_max != null) params.set('score_max', String(filters.score_max));
  if (filters.sort_by) params.set('sort_by', filters.sort_by);
  if (filters.group_by) params.set('group_by', filters.group_by);
  const query = params.toString();
  return apiGet<LeaderboardResponse>(`/leaderboard${query ? `?${query}` : ''}`);
}
