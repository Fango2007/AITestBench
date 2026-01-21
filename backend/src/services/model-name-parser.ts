import { ModelPrecision, ModelProvider, ModelQuantisationMethod } from '../models/model.js';

export interface ModelNameGuess {
  provider: ModelProvider | null;
  parameter_count: number | null;
  parameter_count_label: string | null;
  quantisation: {
    method: ModelQuantisationMethod | null;
    bits: number | null;
  };
  precision: ModelPrecision | null;
}

const providerHints: Array<{ provider: ModelProvider; patterns: RegExp[] }> = [
  { provider: 'openai', patterns: [/openai/i, /\bgpt[-_ ]?\d/i] },
  { provider: 'meta', patterns: [/meta/i, /llama/i] },
  { provider: 'mistral', patterns: [/mistral/i, /devstral/i] },
  { provider: 'qwen', patterns: [/qwen/i] },
  { provider: 'google', patterns: [/google/i, /gemini/i] },
  { provider: 'cohere', patterns: [/cohere/i, /command/i] },
  { provider: 'deepseek', patterns: [/deepseek/i] },
  { provider: 'anthropic', patterns: [/anthropic/i, /claude/i] },
  { provider: 'nvidia', patterns: [/nvidia/i, /nemotron/i] },
  { provider: 'zai', patterns: [/zai/i, /01\.ai/i, /01ai/i, /\byi\b/i] },
  { provider: 'custom', patterns: [/custom/i] }
];

const quantisationHints: Array<{ method: ModelQuantisationMethod; patterns: RegExp[] }> = [
  { method: 'gguf', patterns: [/gguf/i] },
  { method: 'gptq', patterns: [/gptq/i] },
  { method: 'awq', patterns: [/awq/i] },
  { method: 'mlx', patterns: [/mlx/i] }
];

const precisionHints: Array<{ precision: ModelPrecision; patterns: RegExp[] }> = [
  { precision: 'fp32', patterns: [/fp32/i] },
  { precision: 'fp16', patterns: [/fp16/i] },
  { precision: 'bf16', patterns: [/bf16/i] },
  { precision: 'int8', patterns: [/int8/i] },
  { precision: 'int4', patterns: [/int4/i] }
];

function matchFirst<T>(text: string, entries: Array<{ value: T; patterns: RegExp[] }>): T | null {
  for (const entry of entries) {
    if (entry.patterns.some((pattern) => pattern.test(text))) {
      return entry.value;
    }
  }
  return null;
}

function parseParameterCount(text: string): { count: number; label: string } | null {
  const pattern = /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)(b|bn|billion|m|million)(?:[^a-z0-9]|$)/gi;
  let match: RegExpExecArray | null;
  let best: { count: number; label: string } | null = null;
  while ((match = pattern.exec(text)) !== null) {
    const rawValue = parseFloat(match[1]);
    if (!Number.isFinite(rawValue)) {
      continue;
    }
    const unit = match[2].toLowerCase();
    const multiplier = unit.startsWith('b') ? 1_000_000_000 : 1_000_000;
    const count = rawValue * multiplier;
    if (!best || count > best.count) {
      const label = `${rawValue}${unit.startsWith('b') ? 'B' : 'M'}`;
      best = { count, label };
    }
  }
  return best;
}

function parseQuantisationBits(text: string): number | null {
  const labelMatch = text.match(/\bq(\d+)(?:_k_[sml]|_[0-3])\b/i);
  if (labelMatch) {
    const bits = parseFloat(labelMatch[1]);
    return Number.isFinite(bits) ? bits : null;
  }
  const bitMatch = text.match(/(\d+(?:\.\d+)?)\s*bit/i);
  if (bitMatch) {
    const bits = parseFloat(bitMatch[1]);
    return Number.isFinite(bits) ? bits : null;
  }
  const qMatch = text.match(/\bq(\d+(?:\.\d+)?)\b/i);
  if (qMatch) {
    const bits = parseFloat(qMatch[1]);
    return Number.isFinite(bits) ? bits : null;
  }
  return null;
}

export function guessModelCharacteristics(modelName: string): ModelNameGuess {
  const normalized = modelName.trim();
  const provider =
    matchFirst(normalized, providerHints.map((entry) => ({ value: entry.provider, patterns: entry.patterns }))) ??
    null;
  const quantMethod =
    matchFirst(normalized, quantisationHints.map((entry) => ({ value: entry.method, patterns: entry.patterns }))) ??
    null;
  const precision =
    matchFirst(normalized, precisionHints.map((entry) => ({ value: entry.precision, patterns: entry.patterns }))) ??
    null;
  const parameter = parseParameterCount(normalized);
  const quantBits = parseQuantisationBits(normalized);

  return {
    provider,
    parameter_count: parameter?.count ?? null,
    parameter_count_label: parameter?.label ?? null,
    quantisation: {
      method: quantMethod,
      bits: quantBits
    },
    precision
  };
}
