import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from '../models/db.js';

export interface EnvEntry {
  key: string;
  value: string;
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..', '..');
const envPath = path.join(repoRoot, '.env');

function readEnvLines(): string[] {
  if (!fs.existsSync(envPath)) {
    return [];
  }
  const contents = fs.readFileSync(envPath, 'utf8');
  return contents.split(/\r?\n/);
}

function parseEnvEntries(lines: string[]): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    if (!key) {
      continue;
    }
    entries.push({ key, value });
  }
  return entries;
}

function writeEnvLines(lines: string[]): void {
  const output = lines.filter((line, index, array) => {
    if (index < array.length - 1) {
      return true;
    }
    return line.trim() !== '';
  });
  const contents = output.join('\n');
  fs.writeFileSync(envPath, contents.length ? `${contents}\n` : '', 'utf8');
}

export function listEnvEntries(): EnvEntry[] {
  const lines = readEnvLines();
  return parseEnvEntries(lines);
}

export function setEnvEntry(key: string, value: string | null): EnvEntry[] {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    throw new Error('Env key is required');
  }
  const lines = readEnvLines();
  const keyIndex = new Map<string, number>();
  lines.forEach((line, index) => {
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      return;
    }
    const entryKey = line.slice(0, eqIndex).trim();
    if (!entryKey || entryKey.startsWith('#')) {
      return;
    }
    if (!keyIndex.has(entryKey)) {
      keyIndex.set(entryKey, index);
    }
  });

  if (value === null) {
    const existingIndex = keyIndex.get(trimmedKey);
    if (existingIndex !== undefined) {
      lines.splice(existingIndex, 1);
    }
  } else {
    const newLine = `${trimmedKey}=${value}`;
    const existingIndex = keyIndex.get(trimmedKey);
    if (existingIndex !== undefined) {
      lines[existingIndex] = newLine;
    } else {
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
        lines.push('');
      }
      lines.push(newLine);
    }
  }

  writeEnvLines(lines);
  return parseEnvEntries(lines);
}

export function clearDatabase(): void {
  const db = getDb();
  const tables = db
    .prepare(`
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    .all() as Array<{ name: string }>;

  db.pragma('foreign_keys = OFF');
  const clear = db.transaction(() => {
    for (const { name } of tables) {
      db.prepare(`DELETE FROM "${name.replace(/"/g, '""')}"`).run();
    }
  });
  try {
    clear();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
