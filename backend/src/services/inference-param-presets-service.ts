import crypto from 'crypto';

import { getDb } from '../models/db.js';
import { nowIso } from '../models/repositories.js';

export interface InferenceParamPresetParameters {
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  quantization_level: string | null;
  stream: boolean;
}

export interface InferenceParamPresetRecord {
  id: string;
  name: string;
  parameters: InferenceParamPresetParameters;
  created_at: string;
  updated_at: string;
}

interface PresetRow {
  id: string;
  name: string;
  parameters: string;
  created_at: string;
  updated_at: string;
}

export class InferenceParamPresetValidationError extends Error {}

function toRecord(row: PresetRow): InferenceParamPresetRecord {
  return {
    id: row.id,
    name: row.name,
    parameters: JSON.parse(row.parameters) as InferenceParamPresetParameters,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InferenceParamPresetValidationError(`${field} must be a finite number or null`);
  }
  return value;
}

export function normalizePresetParameters(input: unknown): InferenceParamPresetParameters {
  const payload = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const quantization = payload.quantization_level;
  if (quantization !== null && quantization !== undefined && typeof quantization !== 'string') {
    throw new InferenceParamPresetValidationError('quantization_level must be a string or null');
  }
  return {
    temperature: normalizeNumber(payload.temperature, 'temperature'),
    top_p: normalizeNumber(payload.top_p, 'top_p'),
    max_tokens: normalizeNumber(payload.max_tokens, 'max_tokens'),
    quantization_level: typeof quantization === 'string' && quantization.trim() ? quantization.trim() : null,
    stream: typeof payload.stream === 'boolean' ? payload.stream : false
  };
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InferenceParamPresetValidationError('name is required');
  }
  return value.trim().slice(0, 120);
}

export function listInferenceParamPresets(): InferenceParamPresetRecord[] {
  const rows = getDb()
    .prepare('SELECT * FROM inference_param_presets ORDER BY lower(name) ASC')
    .all() as PresetRow[];
  return rows.map(toRecord);
}

export function createInferenceParamPreset(input: Record<string, unknown>): InferenceParamPresetRecord {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = nowIso();
  const name = normalizeName(input.name);
  const parameters = normalizePresetParameters(input.parameters);
  try {
    db.prepare(`
      INSERT INTO inference_param_presets (id, name, parameters, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, JSON.stringify(parameters), now, now);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      throw new InferenceParamPresetValidationError('preset name already exists');
    }
    throw error;
  }
  return { id, name, parameters, created_at: now, updated_at: now };
}

export function updateInferenceParamPreset(id: string, input: Record<string, unknown>): InferenceParamPresetRecord | null {
  const current = getDb()
    .prepare('SELECT * FROM inference_param_presets WHERE id = ?')
    .get(id) as PresetRow | undefined;
  if (!current) {
    return null;
  }
  const name = input.name === undefined ? current.name : normalizeName(input.name);
  const parameters = input.parameters === undefined
    ? JSON.parse(current.parameters) as InferenceParamPresetParameters
    : normalizePresetParameters(input.parameters);
  const updatedAt = nowIso();
  try {
    getDb()
      .prepare('UPDATE inference_param_presets SET name = ?, parameters = ?, updated_at = ? WHERE id = ?')
      .run(name, JSON.stringify(parameters), updatedAt, id);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
      throw new InferenceParamPresetValidationError('preset name already exists');
    }
    throw error;
  }
  return toRecord({ ...current, name, parameters: JSON.stringify(parameters), updated_at: updatedAt });
}

export function deleteInferenceParamPreset(id: string): boolean {
  const result = getDb()
    .prepare('DELETE FROM inference_param_presets WHERE id = ?')
    .run(id);
  return result.changes > 0;
}
