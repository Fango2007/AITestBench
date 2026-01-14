import crypto from 'crypto';

import { getDb } from '../models/db.js';
import {
  TargetRecord,
  TargetModelSummary,
  createTarget,
  deleteTarget,
  getTargetById,
  getTargetByName,
  listTargets,
  updateTarget
} from '../models/target.js';

export interface TargetInput {
  name: string;
  base_url: string;
  auth_type?: string | null;
  provider?: 'openai' | 'ollama' | 'auto';
  auth_token_ref?: string | null;
  default_model?: string | null;
  default_params?: Record<string, unknown> | null;
  timeouts?: Record<string, unknown> | null;
  concurrency_limit?: number | null;
}

export class DuplicateTargetNameError extends Error {
  constructor(name: string) {
    super(`Target name already exists: ${name}`);
    this.name = 'DuplicateTargetNameError';
  }
}

export class InvalidBaseUrlError extends Error {
  constructor(value: string) {
    super(`Invalid base URL: ${value}`);
    this.name = 'InvalidBaseUrlError';
  }
}

function validateBaseUrl(value: string): void {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    throw new InvalidBaseUrlError(value);
  }
}

function buildTargetId(input: TargetInput): string {
  const key = `${input.name}:${input.base_url}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

export function fetchTargets(status?: 'active' | 'archived' | 'all'): TargetRecord[] {
  const targets = listTargets();
  if (!status || status === 'all') {
    return targets;
  }
  return targets.filter((target) => target.status === status);
}

export function fetchTarget(id: string): TargetRecord | null {
  return getTargetById(id);
}

export function createTargetRecord(input: TargetInput): TargetRecord {
  validateBaseUrl(input.base_url);
  const existing = getTargetByName(input.name);
  if (existing) {
    throw new DuplicateTargetNameError(input.name);
  }
  const id = buildTargetId(input);
  return createTarget({
    id,
    name: input.name,
    base_url: input.base_url,
    auth_type: input.auth_type ?? null,
    provider: input.provider ?? 'openai',
    auth_token_ref: input.auth_token_ref ?? null,
    default_model: input.default_model ?? null,
    default_params: input.default_params ?? null,
    timeouts: input.timeouts ?? null,
    concurrency_limit: input.concurrency_limit ?? null,
    status: 'active',
    connectivity_status: 'pending',
    last_check_at: null,
    last_error: null,
    models: null
  });
}

export function updateTargetRecord(id: string, updates: Partial<TargetInput>): TargetRecord | null {
  const existing = getTargetById(id);
  if (!existing) {
    return null;
  }
  if (updates.base_url) {
    validateBaseUrl(updates.base_url);
  }
  if (updates.provider && !['openai', 'ollama', 'auto'].includes(updates.provider)) {
    throw new Error('Unsupported provider');
  }
  if (updates.name && updates.name !== existing.name) {
    const nameMatch = getTargetByName(updates.name);
    if (nameMatch && nameMatch.id !== id) {
      throw new DuplicateTargetNameError(updates.name);
    }
  }
  return updateTarget(id, updates as Partial<TargetRecord>);
}

export function updateTargetConnectivity(
  id: string,
  updates: {
    connectivity_status: TargetRecord['connectivity_status'];
    last_check_at: string | null;
    last_error: string | null;
    models: TargetModelSummary[] | null;
  }
): TargetRecord | null {
  return updateTarget(id, updates as Partial<TargetRecord>);
}

export function updateTargetModel(
  id: string,
  modelId: string,
  updates: Partial<TargetModelSummary>
): TargetRecord | null {
  const existing = getTargetById(id);
  if (!existing || !existing.models) {
    return null;
  }
  const updatedModels = existing.models.map((model) => {
    if (model.model_id === modelId || model.api_model_name === modelId) {
      return { ...model, ...updates };
    }
    return model;
  });
  return updateTarget(id, { models: updatedModels } as Partial<TargetRecord>);
}

export function archiveTarget(id: string): TargetRecord | null {
  return updateTarget(id, { status: 'archived' });
}

export function removeTarget(id: string): boolean {
  return deleteTarget(id);
}

export function canDeleteTarget(id: string): { ok: boolean; reason?: string } {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(1) as count FROM runs WHERE target_id = ?').get(id) as {
    count: number;
  };
  if (row.count > 0) {
    return { ok: false, reason: 'Target has existing runs' };
  }
  return { ok: true };
}
