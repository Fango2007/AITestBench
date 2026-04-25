import crypto from 'crypto';

import { getDb } from './db.js';
import { nowIso } from './repositories.js';

export interface InferenceConfigSnapshot {
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  quantization_level: string | null;
}

export interface EvaluationRecord {
  id: string;
  prompt_id: string;
  model_name: string;
  server_id: string;
  inference_config: InferenceConfigSnapshot;
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

export interface EvaluationCreateInput {
  prompt_id: string;
  model_name: string;
  server_id: string;
  inference_config: InferenceConfigSnapshot;
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

interface EvaluationRow {
  id: string;
  prompt_id: string;
  model_name: string;
  server_id: string;
  inference_config: string;
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

function rowToRecord(row: EvaluationRow): EvaluationRecord {
  return {
    ...row,
    inference_config: JSON.parse(row.inference_config) as InferenceConfigSnapshot
  };
}

export function create(input: EvaluationCreateInput): EvaluationRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const created_at = nowIso();
  db.prepare(`
    INSERT INTO evaluations (
      id, prompt_id, model_name, server_id, inference_config, answer_text,
      input_tokens, output_tokens, total_tokens, latency_ms, word_count, estimated_cost,
      accuracy_score, relevance_score, coherence_score, completeness_score, helpfulness_score,
      note, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
  `).run(
    id,
    input.prompt_id,
    input.model_name,
    input.server_id,
    JSON.stringify(input.inference_config),
    input.answer_text,
    input.input_tokens,
    input.output_tokens,
    input.total_tokens,
    input.latency_ms,
    input.word_count,
    input.estimated_cost,
    input.accuracy_score,
    input.relevance_score,
    input.coherence_score,
    input.completeness_score,
    input.helpfulness_score,
    input.note,
    created_at
  );
  return rowToRecord({ ...input, id, created_at, inference_config: JSON.stringify(input.inference_config) });
}

export function getById(id: string): EvaluationRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM evaluations WHERE id = ?')
    .get(id) as EvaluationRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function list(filters: EvaluationListFilters = {}): { total: number; items: EvaluationRecord[] } {
  const db = getDb();
  const { model_name, date_from, date_to, limit = 100, offset = 0 } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (model_name) {
    conditions.push('model_name = ?');
    params.push(model_name);
  }
  if (date_from) {
    conditions.push('created_at >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('created_at <= ?');
    params.push(date_to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS cnt FROM evaluations ${where}`).get(...params) as { cnt: number }).cnt;
  const rows = db
    .prepare(`SELECT * FROM evaluations ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, Math.min(limit, 500), offset) as EvaluationRow[];

  return { total, items: rows.map(rowToRecord) };
}

export function countByModel(): Array<{ model_name: string; count: number }> {
  const db = getDb();
  return db
    .prepare('SELECT model_name, COUNT(*) AS count FROM evaluations GROUP BY model_name ORDER BY count DESC')
    .all() as Array<{ model_name: string; count: number }>;
}
