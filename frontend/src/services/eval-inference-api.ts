import { apiPost } from './api.js';

export interface InferenceConfig {
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  quantization_level: string | null;
}

export interface EvalInferenceParams {
  server_id: string;
  model_name: string;
  prompt_text: string;
  inference_config: InferenceConfig;
}

export interface EvalInferenceResult {
  answer_text: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number;
  word_count: number;
  estimated_cost: number | null;
}

export function runEvalInference(params: EvalInferenceParams): Promise<EvalInferenceResult> {
  return apiPost<EvalInferenceResult>('/eval-inference', params);
}
