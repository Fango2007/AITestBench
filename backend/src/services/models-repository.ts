import path from 'path';
import { fileURLToPath } from 'url';

import { getInferenceServerById } from '../models/inference-server.js';
import {
  MODEL_SCHEMA_VERSION,
  ModelArchitecture,
  ModelCapabilities,
  ModelConfiguration,
  ModelDiscovery,
  ModelInfo,
  ModelIdentity,
  ModelLimits,
  ModelModalities,
  ModelPerformance,
  ModelProvider,
  ModelRecord,
  createModel,
  getModelById,
  listModels,
  updateModel
} from '../models/model.js';
import { nowIso } from '../models/repositories.js';
import { validateWithSchema } from './schema-validator.js';

export interface ModelInput {
  model?: Partial<ModelInfo>;
  identity?: Partial<ModelIdentity>;
  architecture?: Partial<ModelArchitecture>;
  modalities?: Partial<ModelModalities>;
  capabilities?: Partial<ModelCapabilities>;
  limits?: Partial<ModelLimits>;
  performance?: Partial<ModelPerformance>;
  configuration?: Partial<ModelConfiguration>;
  discovery?: Partial<ModelDiscovery>;
  raw?: Record<string, unknown>;
}

export class InvalidModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidModelError';
  }
}

function resolveSchemaPath(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(moduleDir, '../../../specs/003-model-schema/model-schema.json');
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
    quantisation: { method: 'unknown', bits: null, group_size: null }
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

function mergeIdentity(existing: ModelIdentity | null, updates: Partial<ModelIdentity> | undefined): ModelIdentity {
  return { ...(existing ?? defaultIdentity()), ...(updates ?? {}) };
}

function mergeArchitecture(
  existing: ModelArchitecture | null,
  updates: Partial<ModelArchitecture> | undefined
): ModelArchitecture {
  const base = existing ?? defaultArchitecture();
  if (!updates) {
    return base;
  }
  return {
    ...base,
    ...updates,
    quantisation: { ...base.quantisation, ...updates.quantisation }
  };
}

function mergeModalities(
  existing: ModelModalities | null,
  updates: Partial<ModelModalities> | undefined
): ModelModalities {
  const base = existing ?? defaultModalities();
  if (!updates) {
    return base;
  }
  return {
    input: updates.input ?? base.input,
    output: updates.output ?? base.output
  };
}

function mergeCapabilities(
  existing: ModelCapabilities | null,
  updates: Partial<ModelCapabilities> | undefined
): ModelCapabilities {
  const base = existing ?? defaultCapabilities();
  if (!updates) {
    return base;
  }
  return {
    ...base,
    ...updates,
    generation: { ...base.generation, ...updates.generation },
    multimodal: { ...base.multimodal, ...updates.multimodal },
    reasoning: { ...base.reasoning, ...updates.reasoning }
  };
}

function mergeLimits(existing: ModelLimits | null, updates: Partial<ModelLimits> | undefined): ModelLimits {
  return { ...(existing ?? defaultLimits()), ...(updates ?? {}) };
}

function mergePerformance(
  existing: ModelPerformance | null,
  updates: Partial<ModelPerformance> | undefined
): ModelPerformance {
  const base = existing ?? defaultPerformance();
  if (!updates) {
    return base;
  }
  return {
    ...base,
    ...updates,
    theoretical: { ...base.theoretical, ...updates.theoretical },
    observed: { ...base.observed, ...updates.observed }
  };
}

function mergeConfiguration(
  existing: ModelConfiguration | null,
  updates: Partial<ModelConfiguration> | undefined
): ModelConfiguration {
  const base = existing ?? defaultConfiguration();
  if (!updates) {
    return base;
  }
  return {
    ...base,
    ...updates,
    default_parameters: { ...base.default_parameters, ...updates.default_parameters },
    context_strategy: { ...base.context_strategy, ...updates.context_strategy }
  };
}

function mergeDiscovery(
  existing: ModelDiscovery | null,
  updates: Partial<ModelDiscovery> | undefined
): ModelDiscovery {
  return { ...(existing ?? defaultDiscovery()), ...(updates ?? {}) };
}

function validateModelRecord(record: ModelRecord): void {
  const schemaResult = validateWithSchema(resolveSchemaPath(), record);
  if (schemaResult.ok) {
    return;
  }
  const detail = schemaResult.issues
    .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
    .join('; ');
  throw new InvalidModelError(`Schema validation failed: ${detail}`);
}

export function fetchModels(filters?: {
  active?: boolean;
  archived?: boolean;
  server_id?: string;
  provider?: ModelProvider;
}): ModelRecord[] {
  const models = listModels();
  return models.filter((model) => {
    if (filters?.active !== undefined && model.model.active !== filters.active) {
      return false;
    }
    if (filters?.archived !== undefined && model.model.archived !== filters.archived) {
      return false;
    }
    if (filters?.server_id && model.model.server_id !== filters.server_id) {
      return false;
    }
    if (filters?.provider && model.identity.provider !== filters.provider) {
      return false;
    }
    return true;
  });
}

export function fetchModel(serverId: string, modelId: string): ModelRecord | null {
  return getModelById(serverId, modelId);
}

export function createModelRecord(input: ModelInput): ModelRecord {
  const modelInfo = input.model;
  if (!modelInfo?.model_id) {
    throw new InvalidModelError('model.model_id is required');
  }
  if (!modelInfo.server_id) {
    throw new InvalidModelError('model.server_id is required');
  }
  const modelId = modelInfo.model_id.trim();
  const serverId = modelInfo.server_id.trim();
  if (!modelId) {
    throw new InvalidModelError('model.model_id is required');
  }
  if (!serverId) {
    throw new InvalidModelError('model.server_id is required');
  }
  if (!getInferenceServerById(serverId)) {
    throw new InvalidModelError(`inference server not found: ${serverId}`);
  }
  const displayName = modelInfo.display_name?.trim() || modelId;
  if (getModelById(serverId, modelId)) {
    throw new InvalidModelError(`model already exists: ${serverId}/${modelId}`);
  }

  const now = nowIso();
  const record: ModelRecord = {
    model_schema_version: MODEL_SCHEMA_VERSION,
    model: {
      model_id: modelId,
      server_id: serverId,
      display_name: displayName,
      active: modelInfo.active ?? true,
      archived: modelInfo.archived ?? false,
      created_at: now,
      updated_at: now,
      archived_at: modelInfo.archived_at ?? null
    },
    identity: mergeIdentity(null, input.identity),
    architecture: mergeArchitecture(null, input.architecture),
    modalities: mergeModalities(null, input.modalities),
    capabilities: mergeCapabilities(null, input.capabilities),
    limits: mergeLimits(null, input.limits),
    performance: mergePerformance(null, input.performance),
    configuration: mergeConfiguration(null, input.configuration),
    discovery: mergeDiscovery(null, input.discovery),
    raw: input.raw ?? {}
  };
  if (record.model.archived && !record.model.archived_at) {
    record.model.archived_at = now;
  }
  validateModelRecord(record);
  return createModel(record);
}

export function updateModelRecord(
  serverId: string,
  modelId: string,
  updates: ModelInput
): ModelRecord | null {
  const existing = getModelById(serverId, modelId);
  if (!existing) {
    return null;
  }
  const { model_id: _modelId, server_id: _serverId, created_at: _createdAt, ...modelUpdates } =
    updates.model ?? {};

  const updated: ModelRecord = {
    ...existing,
    model: {
      ...existing.model,
      ...modelUpdates
    },
    model_schema_version: MODEL_SCHEMA_VERSION,
    identity: mergeIdentity(existing.identity, updates.identity),
    architecture: mergeArchitecture(existing.architecture, updates.architecture),
    modalities: mergeModalities(existing.modalities, updates.modalities),
    capabilities: mergeCapabilities(existing.capabilities, updates.capabilities),
    limits: mergeLimits(existing.limits, updates.limits),
    performance: mergePerformance(existing.performance, updates.performance),
    configuration: mergeConfiguration(existing.configuration, updates.configuration),
    discovery: mergeDiscovery(existing.discovery, updates.discovery),
    raw: updates.raw ?? existing.raw
  };

  if (updates.model?.display_name) {
    updated.model.display_name = updates.model.display_name.trim();
  }
  if (updated.model.archived && !updated.model.archived_at) {
    updated.model.archived_at = nowIso();
  }
  if (!updated.model.archived) {
    updated.model.archived_at = null;
  }
  updated.model.updated_at = nowIso();
  validateModelRecord(updated);
  return updateModel(serverId, modelId, updated);
}

export function upsertModelRecord(input: ModelInput): ModelRecord {
  const modelInfo = input.model;
  if (!modelInfo?.model_id || !modelInfo.server_id) {
    throw new InvalidModelError('model.model_id and model.server_id are required');
  }
  const modelId = modelInfo.model_id.trim();
  const serverId = modelInfo.server_id.trim();
  if (!modelId || !serverId) {
    throw new InvalidModelError('model.model_id and model.server_id are required');
  }
  const existing = getModelById(serverId, modelId);
  if (existing) {
    const updated = updateModelRecord(serverId, modelId, {
      ...input,
      model: { ...modelInfo, model_id: modelId, server_id: serverId }
    });
    if (!updated) {
      throw new InvalidModelError('Unable to update model record');
    }
    return updated;
  }
  return createModelRecord({
    ...input,
    model: { ...modelInfo, model_id: modelId, server_id: serverId }
  });
}

export function archiveModel(serverId: string, modelId: string): ModelRecord | null {
  const existing = getModelById(serverId, modelId);
  if (!existing) {
    return null;
  }
  return updateModelRecord(serverId, modelId, {
    model: { active: false, archived: true, archived_at: nowIso() }
  });
}

export function unarchiveModel(serverId: string, modelId: string): ModelRecord | null {
  const existing = getModelById(serverId, modelId);
  if (!existing) {
    return null;
  }
  return updateModelRecord(serverId, modelId, {
    model: { archived: false, archived_at: null }
  });
}
