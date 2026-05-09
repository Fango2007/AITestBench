import { apiGet, apiPost } from './api.js';
import type { InferenceParams } from './inference-param-presets-api.js';

export type EvaluationQueueStatus = 'pending' | 'done' | 'skipped';

export interface EvaluationQueueItem {
  test_result_id: string;
  run_id: string;
  test_id: string;
  template_id: string;
  template_label: string;
  model_name: string;
  server_id: string;
  server_name: string;
  verdict: string;
  status: EvaluationQueueStatus;
  started_at: string;
  ended_at: string | null;
}

export interface EvaluationQueueDetail extends EvaluationQueueItem {
  inference_config: InferenceParams;
  prompt_text: string;
  answer_text: string;
  metrics: Record<string, unknown>;
  artefacts: Record<string, unknown>;
  raw_events: unknown;
  document: Record<string, unknown>;
  evaluation_id: string | null;
  skipped_at: string | null;
}

export interface EvaluationQueueResponse {
  counts: Record<EvaluationQueueStatus, number>;
  items: EvaluationQueueItem[];
}

export interface EvaluationQueueScoreInput {
  accuracy_score: number;
  relevance_score: number;
  coherence_score: number;
  completeness_score: number;
  helpfulness_score: number;
  note: string | null;
}

export function isValidQueueScore(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function validateQueueScores(input: EvaluationQueueScoreInput): boolean {
  return [
    input.accuracy_score,
    input.relevance_score,
    input.coherence_score,
    input.completeness_score,
    input.helpfulness_score
  ].every(isValidQueueScore);
}

export async function listEvaluationQueue(status: EvaluationQueueStatus): Promise<EvaluationQueueResponse> {
  return apiGet<EvaluationQueueResponse>(`/evaluation-queue?status=${status}`);
}

export async function getEvaluationQueueDetail(testResultId: string): Promise<EvaluationQueueDetail> {
  return apiGet<EvaluationQueueDetail>(`/evaluation-queue/${testResultId}`);
}

export async function scoreEvaluationQueueItem(testResultId: string, input: EvaluationQueueScoreInput): Promise<unknown> {
  return apiPost(`/evaluation-queue/${testResultId}/score`, input);
}

export async function skipEvaluationQueueItem(testResultId: string, reason?: string): Promise<void> {
  await apiPost(`/evaluation-queue/${testResultId}/skip`, { reason: reason ?? null });
}
