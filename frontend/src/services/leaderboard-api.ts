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
}

export interface LeaderboardResponse {
  filters_applied: {
    date_from: string | null;
    date_to: string | null;
    tags: string[];
  };
  entries: LeaderboardEntry[];
}

export interface LeaderboardFilters {
  date_from?: string;
  date_to?: string;
  tags?: string[];
}

export function getLeaderboard(filters: LeaderboardFilters = {}): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  const query = params.toString();
  return apiGet<LeaderboardResponse>(`/leaderboard${query ? `?${query}` : ''}`);
}
