import type {
  ModelCapabilityTag,
  ModelFormat,
  ModelProvider,
  ModelQuantisationMethod,
} from './models-api.js';

export interface InferredModelMetadata {
  baseModelName: string | null;
  provider: ModelProvider;
  quantizedProvider: string | null;
  format: ModelFormat | null;
  quantisation: {
    method: ModelQuantisationMethod;
    bits: number | null;
  };
  useCase: Record<ModelCapabilityTag, boolean>;
}

const DROP_PATTERNS = [
  /^mlx$/i,
  /^gguf$/i,
  /^gcuf$/i,
  /^gptq$/i,
  /^awq$/i,
  /^safetensors$/i,
  /^\d+(\.\d+)?bit$/i,
  /^q\d+(_k_[sml]|_[0-3])?$/i,
  /^\d{4,}$/,
  /^fp(16|32)$/i,
  /^bf16$/i,
  /^int[48]$/i,
];

export function inferModelMetadata(modelId: string, displayName = modelId): InferredModelMetadata {
  const text = `${modelId} ${displayName}`;
  const format = inferFormat(text);
  const bits = inferQuantisationBits(text);
  const method = inferQuantisationMethod(text, format);
  return {
    baseModelName: extractBaseModelName(modelId) ?? (displayName.trim() ? displayName.trim() : null),
    provider: inferProvider(text),
    quantizedProvider: inferQuantizedProvider(modelId, Boolean(format || bits || method !== 'unknown')),
    format,
    quantisation: { method, bits },
    useCase: inferUseCase(text),
  };
}

export function extractBaseModelName(modelId: string): string | null {
  if (!modelId.trim()) {
    return null;
  }
  const stripped = modelId.replace(/^\/+/, '').split('/').filter(Boolean).pop() ?? '';
  const parts = stripped.split(/[-_]/);
  while (parts.length > 0 && DROP_PATTERNS.some((pattern) => pattern.test(parts[parts.length - 1]))) {
    parts.pop();
  }
  const result = parts.join('-');
  return result || null;
}

function inferProvider(text: string): ModelProvider {
  if (/mistral|mixtral|devstral/i.test(text)) return 'mistral';
  if (/qwen/i.test(text)) return 'qwen';
  if (/gemini|google|palm|gemma/i.test(text)) return 'google';
  if (/moonshot|\bkimi\b/i.test(text)) return 'moonshot';
  if (/\bgpt[-_ ]?\d|openai/i.test(text)) return 'openai';
  if (/claude|anthropic/i.test(text)) return 'anthropic';
  if (/llama|meta/i.test(text)) return 'meta';
  if (/cohere|command/i.test(text)) return 'cohere';
  if (/deepseek/i.test(text)) return 'deepseek';
  if (/nvidia|nemotron/i.test(text)) return 'nvidia';
  if (/zai|01\.ai|01ai|\byi\b/i.test(text)) return 'zai';
  return 'unknown';
}

function inferFormat(text: string): ModelFormat | null {
  if (/\bmlx\b/i.test(text)) return 'MLX';
  if (/\b(?:gguf|gcuf)\b/i.test(text)) return 'GGUF';
  if (/\bgptq\b/i.test(text)) return 'GPTQ';
  if (/\bawq\b/i.test(text)) return 'AWQ';
  if (/\bsafetensors\b/i.test(text)) return 'SafeTensors';
  return null;
}

function inferQuantisationMethod(text: string, format: ModelFormat | null): ModelQuantisationMethod {
  if (/\b(?:gguf|gcuf)\b/i.test(text) || format === 'GGUF') return 'gguf';
  if (/\bgptq\b/i.test(text) || format === 'GPTQ') return 'gptq';
  if (/\bawq\b/i.test(text) || format === 'AWQ') return 'awq';
  if (/\bmlx\b/i.test(text) || format === 'MLX') return 'mlx';
  return 'unknown';
}

function inferQuantisationBits(text: string): number | null {
  const bitMatch = text.match(/(\d+(?:\.\d+)?)\s*bit/i);
  if (bitMatch) {
    const bits = Number(bitMatch[1]);
    return Number.isFinite(bits) ? bits : null;
  }
  const qMatch = text.match(/\bq(\d+(?:\.\d+)?)(?:_k_[sml]|_[0-3])?\b/i);
  if (qMatch) {
    const bits = Number(qMatch[1]);
    return Number.isFinite(bits) ? bits : null;
  }
  return null;
}

function inferQuantizedProvider(modelId: string, hasQuantizedMetadata: boolean): string | null {
  if (!hasQuantizedMetadata) {
    return null;
  }
  const parts = modelId.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return parts[0].includes('.') && parts.length > 2 ? parts[1] : parts[0];
}

function inferUseCase(text: string): Record<ModelCapabilityTag, boolean> {
  return {
    thinking: /\b(thinking|reasoning|reasoner|qwq|r1)\b/i.test(text),
    coding: /\b(code|coder|coding|devstral)\b/i.test(text),
    instruct: /\b(instruct|chat)\b/i.test(text),
    mixture_of_experts: /\b(moe|mixture[-_ ]?of[-_ ]?experts|mixtral|a\d+b)\b/i.test(text),
  };
}
