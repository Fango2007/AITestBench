import { ModelQuantisationMethod } from '../models/model.js';

export type QuantisationScheme = 'k-quant' | 'legacy' | 'tensorwise' | 'unknown' | null;
export type QuantisationVariant = 'S' | 'M' | 'L' | null;

export interface QuantisationDescriptor {
  method: ModelQuantisationMethod;
  bits: number | null;
  group_size: number | null;
  scheme: QuantisationScheme;
  variant: QuantisationVariant;
  weight_format: string | null;
}

function parseTensorBits(label: string): number | null {
  if (label === 'FP16' || label === 'F16') {
    return 16;
  }
  if (label === 'BF16') {
    return 16;
  }
  if (label === 'FP32' || label === 'F32') {
    return 32;
  }
  return null;
}

export function extractQuantisationLabel(text: string): string | null {
  const candidate = text.toUpperCase();
  const patterns = [
    /(?:^|[^A-Z0-9])(Q\d+_K_[SML])(?:[^A-Z0-9]|$)/,
    /(?:^|[^A-Z0-9])(Q\d+_[0-3])(?:[^A-Z0-9]|$)/,
    /(?:^|[^A-Z0-9])(F16|BF16|FP16|FP32)(?:[^A-Z0-9]|$)/,
    /(?:^|[^A-Z0-9])(\d+(?:\.\d+)?)[-_ ]?BIT(?:[^A-Z0-9]|$)/
  ];
  for (const pattern of patterns) {
    const match = candidate.match(pattern);
    if (match) {
      if (pattern.source.includes('BIT')) {
        return `${match[1]}bit`;
      }
      return match[1];
    }
  }
  return null;
}

export function normaliseQuantisationFromLabel(label: string | null): QuantisationDescriptor {
  const cleanLabel = label?.trim() ?? '';
  const upper = cleanLabel.toUpperCase();
  const hasLabel = Boolean(cleanLabel);

  let scheme: QuantisationScheme = null;
  let variant: QuantisationVariant = null;
  let bits: number | null = null;
  let method: ModelQuantisationMethod = 'unknown';

  if (hasLabel) {
    const variantMatch = upper.match(/^Q(\d+)_K_([SML])$/);
    if (variantMatch) {
      scheme = 'k-quant';
      bits = Number(variantMatch[1]);
      variant = variantMatch[2] as QuantisationVariant;
    }
    if (upper.match(/^Q(\d+)_[0-3]$/)) {
      scheme = 'legacy';
      const bitsMatch = upper.match(/^Q(\d+)_/);
      bits = bitsMatch ? Number(bitsMatch[1]) : null;
    }
    if (upper.includes('_K_') && !scheme) {
      scheme = 'k-quant';
    }
    if (upper === 'F16' || upper === 'BF16' || upper === 'FP16' || upper === 'FP32') {
      method = 'none';
      scheme = 'tensorwise';
      bits = parseTensorBits(upper);
    }
    const bitMatch = upper.match(/^(\d+(?:\.\d+)?)BIT$/);
    if (bitMatch && bits == null) {
      const parsed = Number(bitMatch[1]);
      bits = Number.isFinite(parsed) ? parsed : null;
    }
  }

  return {
    method,
    bits,
    group_size: null,
    scheme,
    variant,
    weight_format: hasLabel ? cleanLabel : null
  };
}
