import { getDb } from './db';
import { nowIso } from './repositories';

export interface TestTemplateRecord {
  id: string;
  name: string;
  format: 'json' | 'python';
  status: 'active' | 'archived';
  owner_id: string;
  current_version_id: string | null;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

export interface TestTemplateVersionRecord {
  id: string;
  template_id: string;
  version_number: number;
  content: string;
  created_at: string;
  created_by: string;
}

export interface TestTemplateSummaryRecord extends TestTemplateRecord {
  current_version_number: number;
}

export interface InstantiatedTestRecord {
  id: string;
  template_id: string;
  template_version_id: string;
  created_at: string;
}

export function createTestTemplate(
  input: Omit<TestTemplateRecord, 'created_at' | 'updated_at'>
): TestTemplateRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO test_templates (
      id, name, format, status, owner_id, current_version_id, storage_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.format,
    input.status,
    input.owner_id,
    input.current_version_id,
    input.storage_path,
    now,
    now
  );
  return { ...input, created_at: now, updated_at: now };
}

export function updateTestTemplate(
  id: string,
  updates: Partial<Omit<TestTemplateRecord, 'id' | 'created_at'>>
): TestTemplateRecord | null {
  const db = getDb();
  const existing = getTestTemplateById(id);
  if (!existing) {
    return null;
  }

  const next = {
    ...existing,
    ...updates,
    updated_at: updates.updated_at ?? nowIso()
  };

  db.prepare(
    `UPDATE test_templates
     SET name = ?, format = ?, status = ?, owner_id = ?, current_version_id = ?,
         storage_path = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    next.name,
    next.format,
    next.status,
    next.owner_id,
    next.current_version_id,
    next.storage_path,
    next.updated_at,
    id
  );

  return next;
}

export function listTestTemplates(status?: 'active' | 'archived' | 'all'): TestTemplateSummaryRecord[] {
  const db = getDb();
  const whereClause = !status || status === 'all' ? '' : 'WHERE t.status = ?';
  const rows = db
    .prepare(
      `SELECT t.*, v.version_number as current_version_number
       FROM test_templates t
       JOIN test_template_versions v ON v.id = t.current_version_id
       ${whereClause}
       ORDER BY t.updated_at DESC`
    )
    .all(...(whereClause ? [status] : [])) as TestTemplateSummaryRecord[];

  return rows;
}

export function getTestTemplateById(id: string): TestTemplateRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM test_templates WHERE id = ?').get(id) as
    | TestTemplateRecord
    | undefined;
  return row ?? null;
}

export function getTestTemplateSummaryById(id: string): TestTemplateSummaryRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT t.*, v.version_number as current_version_number
       FROM test_templates t
       JOIN test_template_versions v ON v.id = t.current_version_id
       WHERE t.id = ?`
    )
    .get(id) as TestTemplateSummaryRecord | undefined;
  return row ?? null;
}

export function getTestTemplateByName(name: string): TestTemplateRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM test_templates WHERE name = ?').get(name) as
    | TestTemplateRecord
    | undefined;
  return row ?? null;
}

export function getActiveTemplateByName(name: string): TestTemplateRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM test_templates WHERE name = ? AND status = ?')
    .get(name, 'active') as TestTemplateRecord | undefined;
  return row ?? null;
}

export function createTemplateVersion(
  input: Omit<TestTemplateVersionRecord, 'created_at'>
): TestTemplateVersionRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO test_template_versions (
      id, template_id, version_number, content, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.template_id,
    input.version_number,
    input.content,
    now,
    input.created_by
  );
  return { ...input, created_at: now };
}

export function listTemplateVersions(templateId: string): TestTemplateVersionRecord[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM test_template_versions
       WHERE template_id = ?
       ORDER BY version_number DESC`
    )
    .all(templateId) as TestTemplateVersionRecord[];
}

export function getTemplateVersionById(id: string): TestTemplateVersionRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM test_template_versions WHERE id = ?')
    .get(id) as TestTemplateVersionRecord | undefined;
  return row ?? null;
}

export function getTemplateVersion(templateId: string, versionId: string): TestTemplateVersionRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM test_template_versions WHERE id = ? AND template_id = ?')
    .get(versionId, templateId) as TestTemplateVersionRecord | undefined;
  return row ?? null;
}

export function getLatestTemplateVersionNumber(templateId: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT MAX(version_number) as max_version FROM test_template_versions WHERE template_id = ?')
    .get(templateId) as { max_version: number | null } | undefined;
  return row?.max_version ?? 0;
}

export function createInstantiatedTest(
  input: Omit<InstantiatedTestRecord, 'created_at'>
): InstantiatedTestRecord {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `INSERT INTO instantiated_tests (
      id, template_id, template_version_id, created_at
    ) VALUES (?, ?, ?, ?)`
  ).run(input.id, input.template_id, input.template_version_id, now);
  return { ...input, created_at: now };
}

export function countInstantiatedTestsByTemplate(templateId: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(1) as count FROM instantiated_tests WHERE template_id = ?')
    .get(templateId) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function deleteTemplate(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM test_templates WHERE id = ?').run(id);
  return result.changes > 0;
}
