import { getInferenceServerById } from '../models/inference-server.js';
import { backendFetch } from './inference-proxy.js';
import { logEvent } from './observability.js';

export interface ModelPricing {
  input: number;
  output: number;
}

export interface EvalInferenceParams {
  server_id: string;
  model_name: string;
  prompt_text: string;
  inference_config: {
    temperature: number | null;
    top_p: number | null;
    max_tokens: number | null;
    quantization_level: string | null;
  };
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

export class ServerNotFoundError extends Error {
  constructor(server_id: string) {
    super(`Server not found or archived: ${server_id}`);
    this.name = 'ServerNotFoundError';
  }
}

export class ServerUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerUnreachableError';
  }
}

export class ModelCallError extends Error {
  public readonly upstreamStatus: number;
  constructor(message: string, upstreamStatus: number) {
    super(message);
    this.name = 'ModelCallError';
    this.upstreamStatus = upstreamStatus;
  }
}

export function computeWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function computeEstimatedCost(
  inputTokens: number | null,
  outputTokens: number | null,
  pricing: ModelPricing | null
): number | null {
  if (!pricing || inputTokens === null || outputTokens === null) {
    return null;
  }
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

function getPricing(_modelName: string): ModelPricing | null {
  return null;
}

const INFERENCE_TIMEOUT_MS = 30_000;

export async function runEvalInference(params: EvalInferenceParams): Promise<EvalInferenceResult> {
  const server = getInferenceServerById(params.server_id);
  if (!server || server.inference_server.archived) {
    throw new ServerNotFoundError(params.server_id);
  }

  const baseUrl = server.endpoints.base_url.replace(/\/$/, '');
  const url = `${baseUrl}/v1/chat/completions`;

  const body: Record<string, unknown> = {
    model: params.model_name,
    messages: [{ role: 'user', content: params.prompt_text }],
    stream: false
  };

  const { temperature, top_p, max_tokens } = params.inference_config;
  if (temperature !== null) body.temperature = temperature;
  if (top_p !== null) body.top_p = top_p;
  if (max_tokens !== null) body.max_tokens = max_tokens;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);
  const startMs = Date.now();

  logEvent({
    level: 'info',
    message: 'eval-inference started',
    meta: { server_id: params.server_id, model_name: params.model_name }
  });

  let response: Response;
  try {
    response = await backendFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('Inference timeout'), { name: 'TimeoutError' });
    }
    throw new ServerUnreachableError(error.message);
  }

  clearTimeout(timer);
  const latency_ms = Date.now() - startMs;

  if (!response.ok) {
    throw new ModelCallError(`Upstream error: ${response.statusText}`, response.status);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const answer_text = json.choices?.[0]?.message?.content ?? '';
  const input_tokens = json.usage?.prompt_tokens ?? null;
  const output_tokens = json.usage?.completion_tokens ?? null;
  const total_tokens = json.usage?.total_tokens ?? null;
  const word_count = computeWordCount(answer_text);
  const pricing = getPricing(params.model_name);
  const estimated_cost = computeEstimatedCost(
    input_tokens !== undefined ? input_tokens : null,
    output_tokens !== undefined ? output_tokens : null,
    pricing
  );

  logEvent({
    level: 'info',
    message: 'eval-inference completed',
    meta: { server_id: params.server_id, model_name: params.model_name, latency_ms, word_count }
  });

  return { answer_text, input_tokens, output_tokens, total_tokens, latency_ms, word_count, estimated_cost };
}
