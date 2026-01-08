import { getDb } from './db';
import { nowIso, parseJsonArray, serializeJson } from './repositories';

export interface SuiteRecord {
  id: string;
  name: string;
  ordered_test_ids: string[];
  filters: Record<string, unknown> | null;
  stop_on_fail: boolean;
  created_at: string;
  updated_at: string;
}

export function upsertSuite(input: Omit<SuiteRecord, 'created_at' | 'updated_at'>): SuiteRecord {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM suites WHERE id = ?').get(input.id) as SuiteRecord | undefined;
  const now = nowIso();

  if (!existing) {
    db.prepare(
      `INSERT INTO suites (
        id, name, ordered_test_ids, filters, stop_on_fail, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.name,
      serializeJson(input.ordered_test_ids),
      serializeJson(input.filters),
      input.stop_on_fail ? 1 : 0,
      now,
      now
    );

    return { ...input, created_at: now, updated_at: now };
  }

  db.prepare(
    `UPDATE suites
     SET name = ?, ordered_test_ids = ?, filters = ?, stop_on_fail = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.name,
    serializeJson(input.ordered_test_ids),
    serializeJson(input.filters),
    input.stop_on_fail ? 1 : 0,
    now,
    input.id
  );

  return { ...input, created_at: existing.created_at, updated_at: now };
}

export function listSuites(): SuiteRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM suites ORDER BY name ASC').all() as SuiteRecord[];
  return rows.map((row) => ({
    ...row,
    ordered_test_ids: parseJsonArray(row.ordered_test_ids as unknown as string),
    filters: row.filters ? JSON.parse(row.filters as unknown as string) : null,
    stop_on_fail: Boolean(row.stop_on_fail)
  }));
}

export function getSuiteById(id: string): SuiteRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM suites WHERE id = ?').get(id) as SuiteRecord | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    ordered_test_ids: parseJsonArray(row.ordered_test_ids as unknown as string),
    filters: row.filters ? JSON.parse(row.filters as unknown as string) : null,
    stop_on_fail: Boolean(row.stop_on_fail)
  };
}
