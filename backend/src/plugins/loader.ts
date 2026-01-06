import fs from 'fs';
import path from 'path';
import { validateJsonTestSpec } from './json-validator';

export interface TestDefinitionMeta {
  id: string;
  version: string;
  name: string;
  description: string;
  protocols: string[];
  runner_type: 'json' | 'python';
  spec_path: string;
  raw: Record<string, unknown>;
}

export interface LoadResult {
  tests: TestDefinitionMeta[];
  errors: string[];
}

const JSON_EXT = '.json';
const PY_EXT = '.py';

export function loadBuiltinTests(): TestDefinitionMeta[] {
  const builtinDir = path.join(__dirname, 'builtins');
  if (!fs.existsSync(builtinDir)) {
    return [];
  }
  const builtins = fs.readdirSync(builtinDir).filter((file) => file.endsWith(JSON_EXT));
  const tests: TestDefinitionMeta[] = [];
  for (const file of builtins) {
    const fullPath = path.join(builtinDir, file);
    try {
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
      tests.push({
        id: String(raw.id),
        version: String(raw.version),
        name: String(raw.name),
        description: String(raw.description),
        protocols: (raw.protocols as string[]) ?? [],
        runner_type: 'json',
        spec_path: fullPath,
        raw
      });
    } catch (err) {
      continue;
    }
  }
  return tests;
}

export function loadTestsFromDir(dirPath: string): LoadResult {
  if (!fs.existsSync(dirPath)) {
    return { tests: [], errors: [`Directory not found: ${dirPath}`] };
  }

  const files = fs.readdirSync(dirPath);
  const tests: TestDefinitionMeta[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (file.endsWith(JSON_EXT)) {
      try {
        const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as Record<string, unknown>;
        const validation = validateJsonTestSpec(raw);
        if (validation.length > 0) {
          for (const issue of validation) {
            errors.push(`${file}: ${issue.message}`);
          }
          continue;
        }
        tests.push({
          id: String(raw.id),
          version: String(raw.version),
          name: String(raw.name),
          description: String(raw.description),
          protocols: (raw.protocols as string[]) ?? [],
          runner_type: 'json',
          spec_path: fullPath,
          raw
        });
      } catch (err) {
        errors.push(`${file}: ${(err as Error).message}`);
      }
      continue;
    }

    if (file.endsWith(PY_EXT)) {
      tests.push({
        id: path.basename(file, PY_EXT),
        version: '0.0.0',
        name: path.basename(file, PY_EXT),
        description: 'Python test definition',
        protocols: [],
        runner_type: 'python',
        spec_path: fullPath,
        raw: {}
      });
    }
  }

  return { tests, errors };
}
