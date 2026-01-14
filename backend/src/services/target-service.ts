import crypto from 'crypto';

import {
  TargetRecord,
  createTarget,
  deleteTarget,
  getTargetById,
  listTargets,
  updateTarget
} from '../models/target.js';
import { getDb } from '../models/db.js';

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

function buildTargetId(input: TargetInput): string {
  const key = `${input.name}:${input.base_url}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 20);
}

export function fetchTargets(): TargetRecord[] {
  return listTargets();
}

export function fetchTarget(id: string): TargetRecord | null {
  return getTargetById(id);
}

export function createTargetRecord(input: TargetInput): TargetRecord {
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
  return updateTarget(id, updates as Partial<TargetRecord>);
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
