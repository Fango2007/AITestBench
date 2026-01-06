import { getDb } from './db';
import { nowIso, parseJsonArray, serializeJson } from './repositories';

export interface TestDefinitionRecord {
  id: string;
  version: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  protocols: string[];
  spec_path: string | null;
  runner_type: 'json' | 'python';
  request_template: Record<string, unknown> | null;
  assertions: Record<string, unknown>[];
  metric_rules: Record<string, unknown> | null;
  created_at: string;
}

export function upsertTestDefinition(
  input: Omit<TestDefinitionRecord, 'created_at'>
): TestDefinitionRecord {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM test_definitions WHERE id = ? AND version = ?')
    .get(input.id, input.version) as TestDefinitionRecord | undefined;

  if (!existing) {
    const now = nowIso();
    db.prepare(
      `INSERT INTO test_definitions (
        id, version, name, description, category, tags, protocols, spec_path,
        runner_type, request_template, assertions, metric_rules, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.version,
      input.name,
      input.description,
      input.category,
      serializeJson(input.tags),
      serializeJson(input.protocols),
      input.spec_path,
      input.runner_type,
      serializeJson(input.request_template),
      serializeJson(input.assertions),
      serializeJson(input.metric_rules),
      now
    );
    return { ...input, created_at: now };
  }

  db.prepare(
    `UPDATE test_definitions
     SET name = ?, description = ?, category = ?, tags = ?, protocols = ?, spec_path = ?,
         runner_type = ?, request_template = ?, assertions = ?, metric_rules = ?
     WHERE id = ? AND version = ?`
  ).run(
    input.name,
    input.description,
    input.category,
    serializeJson(input.tags),
    serializeJson(input.protocols),
    input.spec_path,
    input.runner_type,
    serializeJson(input.request_template),
    serializeJson(input.assertions),
    serializeJson(input.metric_rules),
    input.id,
    input.version
  );

  return { ...input, created_at: existing.created_at };
}

export function listTestDefinitions(): TestDefinitionRecord[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM test_definitions ORDER BY id ASC, version DESC')
    .all() as TestDefinitionRecord[];

  return rows.map((row) => ({
    ...row,
    tags: parseJsonArray(row.tags as unknown as string),
    protocols: parseJsonArray(row.protocols as unknown as string),
    assertions: parseJsonArray(row.assertions as unknown as string),
    request_template: row.request_template ? JSON.parse(row.request_template as unknown as string) : null,
    metric_rules: row.metric_rules ? JSON.parse(row.metric_rules as unknown as string) : null
  }));
}

export function getTestDefinition(id: string, version: string): TestDefinitionRecord | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM test_definitions WHERE id = ? AND version = ?')
    .get(id, version) as TestDefinitionRecord | undefined;
  if (!row) {
    return null;
  }
  return {
    ...row,
    tags: parseJsonArray(row.tags as unknown as string),
    protocols: parseJsonArray(row.protocols as unknown as string),
    assertions: parseJsonArray(row.assertions as unknown as string),
    request_template: row.request_template ? JSON.parse(row.request_template as unknown as string) : null,
    metric_rules: row.metric_rules ? JSON.parse(row.metric_rules as unknown as string) : null
  };
}
