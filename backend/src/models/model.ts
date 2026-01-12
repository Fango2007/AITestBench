import { getDb } from './db.js';
import { nowIso, parseJson, serializeJson } from './repositories.js';

export interface ModelRecord {
  id: string;
  name: string;
  provider: string;
  version: string | null;
  architecture: Record<string, unknown> | null;
  quantisation: Record<string, unknown> | null;
  capabilities: Record<string, unknown> | null;
  raw_metadata: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
}

export function upsertModel(record: Omit<ModelRecord, 'first_seen_at' | 'last_seen_at'>): ModelRecord {
  const db = getDb();
  const now = nowIso();
  const existing = db
    .prepare('SELECT * FROM models WHERE id = ?')
    .get(record.id) as ModelRecord | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO models (
        id, name, provider, version, architecture, quantisation, capabilities,
        raw_metadata, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      record.name,
      record.provider,
      record.version,
      serializeJson(record.architecture),
      serializeJson(record.quantisation),
      serializeJson(record.capabilities),
      serializeJson(record.raw_metadata),
      now,
      now
    );

    return { ...record, first_seen_at: now, last_seen_at: now };
  }

  db.prepare(
    `UPDATE models
     SET name = ?, provider = ?, version = ?, architecture = ?, quantisation = ?,
         capabilities = ?, raw_metadata = ?, last_seen_at = ?
     WHERE id = ?`
  ).run(
    record.name,
    record.provider,
    record.version,
    serializeJson(record.architecture),
    serializeJson(record.quantisation),
    serializeJson(record.capabilities),
    serializeJson(record.raw_metadata),
    now,
    record.id
  );

  return { ...record, first_seen_at: existing.first_seen_at, last_seen_at: now };
}

export function listModels(): ModelRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM models ORDER BY name ASC').all() as ModelRecord[];
  return rows.map((row) => ({
    ...row,
    architecture: parseJson(row.architecture as unknown as string),
    quantisation: parseJson(row.quantisation as unknown as string),
    capabilities: parseJson(row.capabilities as unknown as string),
    raw_metadata: parseJson(row.raw_metadata as unknown as string)
  }));
}

export function getModelById(id: string): ModelRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id) as ModelRecord | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    architecture: parseJson(row.architecture as unknown as string),
    quantisation: parseJson(row.quantisation as unknown as string),
    capabilities: parseJson(row.capabilities as unknown as string),
    raw_metadata: parseJson(row.raw_metadata as unknown as string)
  };
}
