import crypto from 'crypto';

import { getDb } from './db.js';
import { nowIso } from './repositories.js';

export interface EvalPrompt {
  id: string;
  text: string;
  tags: string[];
  created_at: string;
}

interface EvalPromptRow {
  id: string;
  text: string;
  tags: string;
  created_at: string;
}

function rowToEvalPrompt(row: EvalPromptRow): EvalPrompt {
  return {
    id: row.id,
    text: row.text,
    tags: JSON.parse(row.tags) as string[],
    created_at: row.created_at
  };
}

export function findByText(text: string): EvalPrompt | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, text, tags, created_at FROM eval_prompts WHERE text = ? LIMIT 1')
    .get(text) as EvalPromptRow | undefined;
  return row ? rowToEvalPrompt(row) : null;
}

export function create(input: { text: string; tags: string[] }): EvalPrompt {
  const db = getDb();
  const id = crypto.randomUUID();
  const created_at = nowIso();
  db.prepare(
    'INSERT INTO eval_prompts (id, text, tags, created_at) VALUES (?, ?, ?, ?)'
  ).run(id, input.text, JSON.stringify(input.tags), created_at);
  return { id, text: input.text, tags: input.tags, created_at };
}

export function getById(id: string): EvalPrompt | null {
  const db = getDb();
  const row = db
    .prepare('SELECT id, text, tags, created_at FROM eval_prompts WHERE id = ?')
    .get(id) as EvalPromptRow | undefined;
  return row ? rowToEvalPrompt(row) : null;
}

export function list(): EvalPrompt[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, text, tags, created_at FROM eval_prompts ORDER BY created_at DESC')
    .all() as EvalPromptRow[];
  return rows.map(rowToEvalPrompt);
}
