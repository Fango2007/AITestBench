import path from 'path';
import { fileURLToPath } from 'url';

import * as evalPromptModel from '../models/eval-prompt.js';
import * as evaluationModel from '../models/evaluation.js';
import type { EvaluationListFilters } from '../models/evaluation.js';
import { logEvent } from './observability.js';
import { validateWithSchema } from './schema-validator.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const EVAL_SCHEMA_PATH = path.resolve(moduleDir, '../schemas/evaluation.schema.json');

export class EvaluationValidationError extends Error {
  public readonly issues: Array<{ message: string; path?: string }>;
  constructor(issues: Array<{ message: string; path?: string }>) {
    super('Evaluation validation failed');
    this.name = 'EvaluationValidationError';
    this.issues = issues;
  }
}

export interface EvaluationInput {
  prompt_text: string;
  tags: string[];
  server_id: string;
  model_name: string;
  inference_config: {
    temperature: number | null;
    top_p: number | null;
    max_tokens: number | null;
    quantization_level: string | null;
  };
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
  source_test_result_id?: string | null;
}

export async function createEvaluation(input: EvaluationInput) {
  const result = validateWithSchema(EVAL_SCHEMA_PATH, input);
  if (!result.ok) {
    throw new EvaluationValidationError(result.issues);
  }

  let prompt = evalPromptModel.findByText(input.prompt_text);
  if (!prompt) {
    prompt = evalPromptModel.create({ text: input.prompt_text, tags: input.tags });
  }

  const evaluation = evaluationModel.create({
    prompt_id: prompt.id,
    model_name: input.model_name,
    server_id: input.server_id,
    inference_config: input.inference_config,
    answer_text: input.answer_text,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens,
    total_tokens: input.total_tokens,
    latency_ms: input.latency_ms,
    word_count: input.word_count,
    estimated_cost: input.estimated_cost,
    accuracy_score: input.accuracy_score,
    relevance_score: input.relevance_score,
    coherence_score: input.coherence_score,
    completeness_score: input.completeness_score,
    helpfulness_score: input.helpfulness_score,
    note: input.note,
    source_test_result_id: input.source_test_result_id ?? null
  });

  logEvent({
    level: 'info',
    message: 'evaluation created',
    meta: { evaluation_id: evaluation.id, model_name: evaluation.model_name, prompt_id: prompt.id }
  });

  return evaluation;
}

export function listEvaluations(filters: EvaluationListFilters = {}) {
  return evaluationModel.list(filters);
}
