import crypto from 'crypto';
import { ModelRecord, upsertModel } from '../models/model.js';

export interface ModelMetadataInput {
  name: string;
  provider: string;
  version?: string | null;
  architecture?: Record<string, unknown> | null;
  quantisation?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  raw_metadata?: Record<string, unknown> | null;
}

function buildModelId(input: ModelMetadataInput): string {
  const key = `${input.provider}:${input.name}:${input.version ?? 'unknown'}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

export function recordModelMetadata(input: ModelMetadataInput): ModelRecord {
  const record = {
    id: buildModelId(input),
    name: input.name,
    provider: input.provider,
    version: input.version ?? null,
    architecture: input.architecture ?? null,
    quantisation: input.quantisation ?? null,
    capabilities: input.capabilities ?? null,
    raw_metadata: input.raw_metadata ?? null
  };

  return upsertModel(record);
}
