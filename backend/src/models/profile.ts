import { getDb } from './db';
import { nowIso, parseJson, serializeJson } from './repositories';

export interface ProfileRecord {
  id: string;
  version: string;
  name: string;
  description: string | null;
  generation_parameters: Record<string, unknown> | null;
  context_strategy: Record<string, unknown> | null;
  test_selection: Record<string, unknown> | null;
  execution_behaviour: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function upsertProfile(
  record: Omit<ProfileRecord, 'created_at' | 'updated_at'>
): ProfileRecord {
  const db = getDb();
  const now = nowIso();
  const existing = db
    .prepare('SELECT * FROM profiles WHERE id = ? AND version = ?')
    .get(record.id, record.version) as ProfileRecord | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO profiles (
        id, version, name, description, generation_parameters, context_strategy,
        test_selection, execution_behaviour, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      record.id,
      record.version,
      record.name,
      record.description,
      serializeJson(record.generation_parameters),
      serializeJson(record.context_strategy),
      serializeJson(record.test_selection),
      serializeJson(record.execution_behaviour),
      now,
      now
    );

    return { ...record, created_at: now, updated_at: now };
  }

  db.prepare(
    `UPDATE profiles
     SET name = ?, description = ?, generation_parameters = ?, context_strategy = ?,
         test_selection = ?, execution_behaviour = ?, updated_at = ?
     WHERE id = ? AND version = ?`
  ).run(
    record.name,
    record.description,
    serializeJson(record.generation_parameters),
    serializeJson(record.context_strategy),
    serializeJson(record.test_selection),
    serializeJson(record.execution_behaviour),
    now,
    record.id,
    record.version
  );

  return { ...record, created_at: existing.created_at, updated_at: now };
}

export function listProfiles(): ProfileRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM profiles ORDER BY name ASC, version DESC')
    .all() as ProfileRecord[];

  return rows.map((row) => ({
    ...row,
    generation_parameters: parseJson(row.generation_parameters as unknown as string),
    context_strategy: parseJson(row.context_strategy as unknown as string),
    test_selection: parseJson(row.test_selection as unknown as string),
    execution_behaviour: parseJson(row.execution_behaviour as unknown as string)
  }));
}

export function getProfileById(id: string, version: string): ProfileRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM profiles WHERE id = ? AND version = ?')
    .get(id, version) as ProfileRecord | undefined;

  if (!row) {
    return null;
  }

  return {
    ...row,
    generation_parameters: parseJson(row.generation_parameters as unknown as string),
    context_strategy: parseJson(row.context_strategy as unknown as string),
    test_selection: parseJson(row.test_selection as unknown as string),
    execution_behaviour: parseJson(row.execution_behaviour as unknown as string)
  };
}
