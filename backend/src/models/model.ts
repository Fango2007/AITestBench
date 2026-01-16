import { getDb } from './db.js';
import { nowIso, parseJson, serializeJson } from './repositories.js';

export const MODEL_SCHEMA_VERSION = '1.0.0';

export type ModelProvider = 'openai' | 'meta' | 'mistral' | 'qwen' | 'google' | 'custom' | 'unknown';
export type ModelArchitectureType = 'decoder-only' | 'encoder-decoder' | 'other' | 'unknown';
export type ModelPrecision = 'fp32' | 'fp16' | 'bf16' | 'int8' | 'int4' | 'mixed' | 'unknown';
export type ModelQuantisationMethod = 'gguf' | 'gptq' | 'awq' | 'mlx' | 'none' | 'unknown';
export type ContextStrategyType = 'truncate' | 'sliding' | 'summarise' | 'custom';
export type DiscoverySource = 'server' | 'manual' | 'test';

export interface ModelInfo {
  model_id: string;
  server_id: string;
  display_name: string;
  active: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ModelIdentity {
  provider: ModelProvider;
  family: string | null;
  version: string | null;
  revision: string | null;
  checksum: string | null;
}

export interface ModelArchitecture {
  type: ModelArchitectureType;
  parameter_count: number | null;
  precision: ModelPrecision;
  quantisation: {
    method: ModelQuantisationMethod;
    bits: number | null;
    group_size: number | null;
  };
}

export interface ModelModalities {
  input: string[];
  output: string[];
}

export interface ModelCapabilities {
  generation: {
    text: boolean;
    json_schema_output: boolean;
    tools: boolean;
    embeddings: boolean;
  };
  multimodal: {
    vision: boolean;
    audio: boolean;
  };
  reasoning: {
    supported: boolean;
    explicit_tokens: boolean;
  };
}

export interface ModelLimits {
  context_window_tokens: number | null;
  max_output_tokens: number | null;
  max_images: number | null;
  max_batch_size: number | null;
}

export interface ModelPerformance {
  theoretical: {
    tokens_per_second: number | null;
  };
  observed: {
    prefill_tps: number | null;
    generation_tps: number | null;
    latency_ms_p50: number | null;
    latency_ms_p95: number | null;
    measured_at: string | null;
  };
}

export interface ModelConfiguration {
  default_parameters: {
    temperature: number | null;
    top_p: number | null;
    top_k: number | null;
    presence_penalty: number | null;
    frequency_penalty: number | null;
    seed: number | null;
  };
  context_strategy: {
    type: ContextStrategyType;
    window_tokens: number | null;
  };
}

export interface ModelDiscovery {
  retrieved_at: string;
  source: DiscoverySource;
}

export interface ModelRecord {
  model_schema_version: string;
  model: ModelInfo;
  identity: ModelIdentity;
  architecture: ModelArchitecture;
  modalities: ModelModalities;
  capabilities: ModelCapabilities;
  limits: ModelLimits;
  performance: ModelPerformance;
  configuration: ModelConfiguration;
  discovery: ModelDiscovery;
  raw: Record<string, unknown>;
}

function defaultIdentity(): ModelIdentity {
  return {
    provider: 'unknown',
    family: null,
    version: null,
    revision: null,
    checksum: null
  };
}

function defaultArchitecture(): ModelArchitecture {
  return {
    type: 'unknown',
    parameter_count: null,
    precision: 'unknown',
    quantisation: {
      method: 'unknown',
      bits: null,
      group_size: null
    }
  };
}

function defaultModalities(): ModelModalities {
  return { input: ['text'], output: ['text'] };
}

function defaultCapabilities(): ModelCapabilities {
  return {
    generation: { text: false, json_schema_output: false, tools: false, embeddings: false },
    multimodal: { vision: false, audio: false },
    reasoning: { supported: false, explicit_tokens: false }
  };
}

function defaultLimits(): ModelLimits {
  return {
    context_window_tokens: null,
    max_output_tokens: null,
    max_images: null,
    max_batch_size: null
  };
}

function defaultPerformance(): ModelPerformance {
  return {
    theoretical: { tokens_per_second: null },
    observed: {
      prefill_tps: null,
      generation_tps: null,
      latency_ms_p50: null,
      latency_ms_p95: null,
      measured_at: null
    }
  };
}

function defaultConfiguration(): ModelConfiguration {
  return {
    default_parameters: {
      temperature: null,
      top_p: null,
      top_k: null,
      presence_penalty: null,
      frequency_penalty: null,
      seed: null
    },
    context_strategy: { type: 'custom', window_tokens: null }
  };
}

function defaultDiscovery(): ModelDiscovery {
  return { retrieved_at: nowIso(), source: 'manual' };
}

function mapRow(row: {
  server_id: string;
  model_id: string;
  display_name: string;
  active: number;
  archived: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  model_schema_version: string;
  identity: string | null;
  architecture: string | null;
  modalities: string | null;
  capabilities: string | null;
  limits: string | null;
  performance: string | null;
  configuration: string | null;
  discovery: string | null;
  raw: string | null;
}): ModelRecord {
  return {
    model_schema_version: row.model_schema_version ?? MODEL_SCHEMA_VERSION,
    model: {
      model_id: row.model_id,
      server_id: row.server_id,
      display_name: row.display_name,
      active: Boolean(row.active),
      archived: Boolean(row.archived),
      created_at: row.created_at,
      updated_at: row.updated_at,
      archived_at: row.archived_at
    },
    identity: (parseJson(row.identity ?? '') as ModelIdentity) ?? defaultIdentity(),
    architecture: (parseJson(row.architecture ?? '') as ModelArchitecture) ?? defaultArchitecture(),
    modalities: (parseJson(row.modalities ?? '') as ModelModalities) ?? defaultModalities(),
    capabilities: (parseJson(row.capabilities ?? '') as ModelCapabilities) ?? defaultCapabilities(),
    limits: (parseJson(row.limits ?? '') as ModelLimits) ?? defaultLimits(),
    performance: (parseJson(row.performance ?? '') as ModelPerformance) ?? defaultPerformance(),
    configuration: (parseJson(row.configuration ?? '') as ModelConfiguration) ?? defaultConfiguration(),
    discovery: (parseJson(row.discovery ?? '') as ModelDiscovery) ?? defaultDiscovery(),
    raw: (parseJson(row.raw ?? '') as Record<string, unknown>) ?? {}
  };
}

export function listModels(): ModelRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM models ORDER BY display_name ASC')
    .all() as Array<{
    server_id: string;
    model_id: string;
    display_name: string;
    active: number;
    archived: number;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
    model_schema_version: string;
    identity: string | null;
    architecture: string | null;
    modalities: string | null;
    capabilities: string | null;
    limits: string | null;
    performance: string | null;
    configuration: string | null;
    discovery: string | null;
    raw: string | null;
  }>;
  return rows.map(mapRow);
}

export function getModelById(serverId: string, modelId: string): ModelRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM models WHERE server_id = ? AND model_id = ?')
    .get(serverId, modelId) as
    | {
        server_id: string;
        model_id: string;
        display_name: string;
        active: number;
        archived: number;
        created_at: string;
        updated_at: string;
        archived_at: string | null;
        model_schema_version: string;
        identity: string | null;
        architecture: string | null;
        modalities: string | null;
        capabilities: string | null;
        limits: string | null;
        performance: string | null;
        configuration: string | null;
        discovery: string | null;
        raw: string | null;
      }
    | undefined;
  if (!row) {
    return null;
  }
  return mapRow(row);
}

export function createModel(
  input: Omit<ModelRecord, 'model'> & {
    model: Omit<ModelInfo, 'created_at' | 'updated_at'>;
  }
): ModelRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO models (
      server_id, model_id, display_name, active, archived, created_at, updated_at, archived_at,
      model_schema_version, identity, architecture, modalities, capabilities, limits,
      performance, configuration, discovery, raw
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.model.server_id,
    input.model.model_id,
    input.model.display_name,
    input.model.active ? 1 : 0,
    input.model.archived ? 1 : 0,
    now,
    now,
    input.model.archived_at,
    input.model_schema_version,
    serializeJson(input.identity),
    serializeJson(input.architecture),
    serializeJson(input.modalities),
    serializeJson(input.capabilities),
    serializeJson(input.limits),
    serializeJson(input.performance),
    serializeJson(input.configuration),
    serializeJson(input.discovery),
    serializeJson(input.raw)
  );

  return {
    ...input,
    model: {
      ...input.model,
      created_at: now,
      updated_at: now
    }
  };
}

export function updateModel(
  serverId: string,
  modelId: string,
  updates: Partial<ModelRecord>
): ModelRecord | null {
  const existing = getModelById(serverId, modelId);
  if (!existing) {
    return null;
  }
  const db = getDb();
  const now = nowIso();
  const merged: ModelRecord = {
    ...existing,
    ...updates,
    model: {
      ...existing.model,
      ...updates.model,
      updated_at: now
    }
  };

  db.prepare(
    `UPDATE models
     SET display_name = ?, active = ?, archived = ?, updated_at = ?, archived_at = ?,
         model_schema_version = ?, identity = ?, architecture = ?, modalities = ?,
         capabilities = ?, limits = ?, performance = ?, configuration = ?, discovery = ?, raw = ?
     WHERE server_id = ? AND model_id = ?`
  ).run(
    merged.model.display_name,
    merged.model.active ? 1 : 0,
    merged.model.archived ? 1 : 0,
    merged.model.updated_at,
    merged.model.archived_at,
    merged.model_schema_version,
    serializeJson(merged.identity),
    serializeJson(merged.architecture),
    serializeJson(merged.modalities),
    serializeJson(merged.capabilities),
    serializeJson(merged.limits),
    serializeJson(merged.performance),
    serializeJson(merged.configuration),
    serializeJson(merged.discovery),
    serializeJson(merged.raw),
    serverId,
    modelId
  );

  return merged;
}

export function deleteModel(serverId: string, modelId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM models WHERE server_id = ? AND model_id = ?').run(serverId, modelId);
  return result.changes > 0;
}
