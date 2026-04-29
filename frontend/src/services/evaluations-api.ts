import { apiGet, apiPost } from './api.js';

import type { InferenceConfig } from './eval-inference-api.js';

export interface EvaluationRecord {
  id: string;
  prompt_id: string;
  model_name: string;
  server_id: string;
  inference_config: InferenceConfig;
  answer_text: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  word_count: number | null;
  estimated_cost: number | null;
  accuracy_score: number;
  relevance_score: number;
  coherence_score: number;
  completeness_score: number;
  helpfulness_score: number;
  note: string | null;
  created_at: string;
}

export interface EvaluationInput {
  prompt_text: string;
  tags: string[];
  server_id: string;
  model_name: string;
  inference_config: InferenceConfig;
  answer_text: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  word_count: number | null;
  estimated_cost: number | null;
  accuracy_score: number;
  relevance_score: number;
  coherence_score: number;
  completeness_score: number;
  helpfulness_score: number;
  note: string | null;
}

export interface EvaluationListFilters {
  model_name?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface EvaluationListResponse {
  total: number;
  items: EvaluationRecord[];
}

export function createEvaluation(input: EvaluationInput): Promise<EvaluationRecord> {
  return apiPost<EvaluationRecord>('/evaluations', input);
}

export function listEvaluations(filters: EvaluationListFilters = {}): Promise<EvaluationListResponse> {
  const params = new URLSearchParams();
  if (filters.model_name) params.set('model_name', filters.model_name);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  if (filters.offset != null) params.set('offset', String(filters.offset));
  const query = params.toString();
  return apiGet<EvaluationListResponse>(`/evaluations${query ? `?${query}` : ''}`);
}
