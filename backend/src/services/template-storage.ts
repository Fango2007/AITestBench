import fs from 'fs';
import path from 'path';

export type TemplateType = 'json' | 'python';

export interface TemplateFile {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
  version: string;
  created_at: string;
  updated_at: string;
  filePath: string;
}

export class TemplateStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateStorageError';
  }
}

const DEFAULT_TEMPLATES_DIR = path.join(process.cwd(), 'backend', 'data', 'templates');
let warnedFallback = false;

function warnFallback(message: string): void {
  if (warnedFallback) {
    return;
  }
  warnedFallback = true;
  console.warn(message);
}

function resolveTemplatesDir(): string {
  const configured = process.env.AITESTBENCH_TEST_TEMPLATES_DIR?.trim();
  if (configured) {
    return configured;
  }
  warnFallback('AITESTBENCH_TEST_TEMPLATES_DIR not set; using default templates directory.');
  return DEFAULT_TEMPLATES_DIR;
}

function ensureDir(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function getTemplatesDir(): string {
  const configured = resolveTemplatesDir();
  try {
    return ensureDir(configured);
  } catch (error) {
    const fallback = ensureDir(DEFAULT_TEMPLATES_DIR);
    warnFallback(
      `Failed to access configured templates directory "${configured}". Falling back to "${fallback}".`
    );
    return fallback;
  }
}

function readJsonTemplate(filePath: string): TemplateFile | null {
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const stats = fs.statSync(filePath);

  if (parsed && parsed.kind === 'python_test') {
    return {
      id: String(parsed.id ?? path.basename(filePath, '.json')),
      name: String(parsed.name ?? path.basename(filePath, '.json')),
      type: 'python',
      content: JSON.stringify(parsed, null, 2),
      version: String(parsed.version ?? '0.0.0'),
      created_at: stats.birthtime.toISOString(),
      updated_at: stats.mtime.toISOString(),
      filePath
    };
  }

  if (parsed && typeof parsed.type === 'string' && 'content' in parsed) {
    const type = parsed.type === 'python' ? 'python' : 'json';
    const content = type === 'python' ? String(parsed.content ?? '') : JSON.stringify(parsed.content ?? {}, null, 2);
    return {
      id: String(parsed.id ?? path.basename(filePath, '.json')),
      name: String(parsed.name ?? path.basename(filePath, '.json')),
      type,
      content,
      version: String(parsed.version ?? '0.0.0'),
      created_at: stats.birthtime.toISOString(),
      updated_at: stats.mtime.toISOString(),
      filePath
    };
  }

  return {
    id: String(parsed?.id ?? path.basename(filePath, '.json')),
    name: String(parsed?.name ?? path.basename(filePath, '.json')),
    type: 'json',
    content: raw,
    version: String(parsed?.version ?? '0.0.0'),
    created_at: stats.birthtime.toISOString(),
    updated_at: stats.mtime.toISOString(),
    filePath
  };
}

function readPythonTemplate(filePath: string): TemplateFile | null {
  const raw = fs.readFileSync(filePath, 'utf8');
  const stats = fs.statSync(filePath);
  const id = path.basename(filePath, '.py');
  const metaPath = `${filePath}.meta.json`;
  let name = id;
  let version = '0.0.0';
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
      name = String(meta.name ?? id);
      version = String(meta.version ?? '0.0.0');
    } catch {
      // Fall back to defaults.
    }
  }
  return {
    id,
    name,
    type: 'python',
    content: raw,
    version,
    created_at: stats.birthtime.toISOString(),
    updated_at: stats.mtime.toISOString(),
    filePath
  };
}

export function listTemplates(): TemplateFile[] {
  try {
    const dir = getTemplatesDir();
    const entries = fs.readdirSync(dir);
    const templates: TemplateFile[] = [];

    for (const entry of entries) {
      if (entry.endsWith('.meta.json')) {
        continue;
      }
      const filePath = path.join(dir, entry);
      if (entry.endsWith('.json')) {
        const template = readJsonTemplate(filePath);
        if (template) {
          templates.push(template);
        }
        continue;
      }
      if (entry.endsWith('.py')) {
        const template = readPythonTemplate(filePath);
        if (template) {
          templates.push(template);
        }
      }
    }

    return templates;
  } catch (error) {
    throw new TemplateStorageError(
      `Failed to list templates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function getTemplateById(id: string): TemplateFile | null {
  return listTemplates().find((template) => template.id === id) ?? null;
}

export function writeTemplateFile(
  input: Omit<TemplateFile, 'created_at' | 'updated_at' | 'filePath'>
): TemplateFile {
  const dir = getTemplatesDir();
  const now = new Date().toISOString();
  if (input.type === 'python') {
    const filePath = path.join(dir, `${input.id}.pytest.json`);
    try {
      fs.writeFileSync(filePath, input.content, 'utf8');
      return {
        ...input,
        created_at: now,
        updated_at: now,
        filePath
      };
    } catch (error) {
      throw new TemplateStorageError(
        `Failed to write python template: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  const filePath = path.join(dir, `${input.id}.json`);
  const parsed = JSON.parse(input.content) as Record<string, unknown>;
  parsed.id = input.id;
  parsed.name = input.name;
  parsed.version = input.version;
  try {
    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
    return {
      ...input,
      content: JSON.stringify(parsed, null, 2),
      created_at: now,
      updated_at: now,
      filePath
    };
  } catch (error) {
    throw new TemplateStorageError(
      `Failed to write json template: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function deleteTemplateFiles(template: TemplateFile): void {
  try {
    if (fs.existsSync(template.filePath)) {
      fs.unlinkSync(template.filePath);
    }
    if (template.type === 'python') {
      const metaPath = `${template.filePath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
    }
  } catch (error) {
    throw new TemplateStorageError(
      `Failed to delete template files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
