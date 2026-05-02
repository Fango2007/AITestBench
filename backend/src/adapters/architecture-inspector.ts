import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { validateWithSchema } from '../services/schema-validator.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, '..', '..', '..');
export const DATA_DIR = path.join(repoRoot, 'backend', 'data', 'model');

fs.mkdirSync(DATA_DIR, { recursive: true });

const PYTHON_SCRIPT = path.join(moduleDir, '..', 'scripts', 'inspect_architecture.py');
const ARCHITECTURE_TREE_SCHEMA = path.join(moduleDir, '..', 'schemas', 'architecture-tree.schema.json');

const WINDOWS_RESERVED = /^(CON|NUL|PRN|AUX|COM[0-9]|LPT[0-9])$/i;

function hasControlChars(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export type InspectorError =
  | { code: 'not_cached' }
  | { code: 'concurrency_limit' }
  | { code: 'inspection_in_progress' }
  | { code: 'not_inspectable' }
  | { code: 'hf_token_required' }
  | { code: 'unregistered_architecture' }
  | { code: 'inspection_failed'; message: string };

export interface ArchitectureLayerNode {
  name: string;
  type: string;
  parameters: number;
  trainable: boolean;
  shape: number[] | null;
  children: ArchitectureLayerNode[];
}

export interface ArchitectureSummary {
  total_parameters: number;
  trainable_parameters: number;
  non_trainable_parameters: number;
  by_type: Array<{ type: string; count: number; parameters: number }>;
}

export interface ArchitectureTree {
  schema_version: '1.0.0';
  model_id: string;
  format: 'transformers' | 'gguf';
  summary: ArchitectureSummary;
  root: ArchitectureLayerNode;
  inspected_at: string;
}

// Global semaphore — max 2 active inspections at once
let activeInspections = 0;
const MAX_CONCURRENT = 2;

// Per-model lock to detect duplicate in-flight inspections
const inFlightModels = new Set<string>();

export function sanitizeModelId(raw: string): string {
  const sanitized = raw.replace(/\//g, '--').trim();

  if (hasControlChars(sanitized)) {
    throw Object.assign(new Error('Invalid model_id: control characters'), { code: 'not_inspectable' });
  }
  if (sanitized.includes('..')) {
    throw Object.assign(new Error('Invalid model_id: path traversal'), { code: 'not_inspectable' });
  }
  if (sanitized.startsWith('.')) {
    throw Object.assign(new Error('Invalid model_id: leading dot'), { code: 'not_inspectable' });
  }
  if (WINDOWS_RESERVED.test(sanitized)) {
    throw Object.assign(new Error('Invalid model_id: reserved name'), { code: 'not_inspectable' });
  }
  if (sanitized.length > 255) {
    throw Object.assign(new Error('Invalid model_id: too long'), { code: 'not_inspectable' });
  }

  const resolved = path.resolve(DATA_DIR, sanitized);
  if (!resolved.startsWith(DATA_DIR + path.sep) && resolved !== DATA_DIR) {
    throw Object.assign(new Error('Invalid model_id: path escape'), { code: 'not_inspectable' });
  }

  return sanitized;
}

function modelCacheDir(sanitized: string): string {
  return path.join(DATA_DIR, sanitized);
}

function layerTreePath(cacheDir: string): string {
  return path.join(cacheDir, 'layer-tree.json');
}

function configPath(cacheDir: string): string {
  return path.join(cacheDir, 'config.json');
}

function isValidArchitectureTree(value: unknown): value is ArchitectureTree {
  return validateWithSchema(ARCHITECTURE_TREE_SCHEMA, value).ok;
}

export function readCachedTree(sanitized: string): ArchitectureTree | InspectorError {
  const treePath = layerTreePath(modelCacheDir(sanitized));
  if (!fs.existsSync(treePath)) {
    return { code: 'not_cached' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(treePath, 'utf8'));
  } catch {
    _deleteCacheFiles(sanitized);
    return { code: 'not_cached' };
  }
  if (!isValidArchitectureTree(parsed)) {
    _deleteCacheFiles(sanitized);
    return { code: 'not_cached' };
  }
  return parsed;
}

function _deleteCacheFiles(sanitized: string): void {
  const dir = modelCacheDir(sanitized);
  try { fs.rmSync(layerTreePath(dir), { force: true }); } catch { /* ignore */ }
  try { fs.rmSync(configPath(dir), { force: true }); } catch { /* ignore */ }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function resolvePythonBin(): string {
  const configured = process.env.AITESTBENCH_PYTHON_BIN?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }
  return 'python3';
}

export interface InspectOptions {
  modelId: string;
  sanitizedId: string;
  format?: 'gguf' | 'transformers';
  modelPath?: string;
  trustRemoteCode: boolean;
}

export async function runInspection(opts: InspectOptions): Promise<ArchitectureTree | InspectorError> {
  const lockKey = opts.sanitizedId;

  if (inFlightModels.has(lockKey)) {
    return { code: 'inspection_in_progress' };
  }
  if (activeInspections >= MAX_CONCURRENT) {
    return { code: 'concurrency_limit' };
  }

  inFlightModels.add(lockKey);
  activeInspections++;

  try {
    return await _spawnInspection(opts);
  } finally {
    inFlightModels.delete(lockKey);
    activeInspections--;
  }
}

async function _spawnInspection(opts: InspectOptions): Promise<ArchitectureTree | InspectorError> {
  const { modelId, sanitizedId, format, modelPath, trustRemoteCode } = opts;
  const cacheDir = modelCacheDir(sanitizedId);
  fs.mkdirSync(cacheDir, { recursive: true });

  const token = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_HUB_TOKEN ?? '';
  const pythonBin = resolvePythonBin();

  const args: string[] = ['--model_id', modelId];
  if (token) args.push('--hf_token', token);
  if (trustRemoteCode) args.push('--trust_remote_code');
  if (format === 'gguf') args.push('--format', 'gguf');
  if (modelPath) args.push('--model_path', modelPath);

  const argStr = args.map(shellEscape).join(' ');
  const cpuSeconds = 120;
  const ulimit = process.platform === 'linux'
    ? `ulimit -t ${cpuSeconds} && ulimit -v ${2 * 1024 * 1024}`
    : `ulimit -t ${cpuSeconds}`;
  const command = `${ulimit} && ${shellEscape(pythonBin)} ${shellEscape(PYTHON_SCRIPT)} ${argStr}`;

  const childEnv: Record<string, string> = {};
  if (token) childEnv['HF_TOKEN'] = token;

  const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const proc = spawn('bash', ['-lc', command], {
      env: { ...process.env, ...childEnv },
      cwd: repoRoot
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      _deleteCacheFiles(sanitizedId);
    }, 60_000);

    proc.stdout.on('data', (chunk) => { stdout += (chunk as Buffer).toString(); });
    proc.stderr.on('data', (chunk) => { stderr += (chunk as Buffer).toString(); });
    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });
  });

  if (result.exitCode !== 0) {
    _deleteCacheFiles(sanitizedId);
    const scrubbed = result.stderr.replace(token ? new RegExp(escapeRegex(token), 'g') : /(?:)/, '[REDACTED]');
    if (result.stderr.includes('unregistered_architecture')) {
      return { code: 'unregistered_architecture' };
    }
    if (result.stderr.includes('hf_token_required') || result.stderr.includes('401') || result.stderr.includes('403')) {
      return { code: 'hf_token_required' };
    }
    return { code: 'inspection_failed', message: scrubbed.slice(0, 500) };
  }

  let tree: ArchitectureTree;
  try {
    tree = JSON.parse(result.stdout) as ArchitectureTree;
  } catch {
    _deleteCacheFiles(sanitizedId);
    return { code: 'inspection_failed', message: 'Failed to parse inspection output' };
  }
  if (!isValidArchitectureTree(tree)) {
    _deleteCacheFiles(sanitizedId);
    return { code: 'inspection_failed', message: 'Inspection output did not match the architecture schema' };
  }

  // Write config.json then layer-tree.json atomically
  const tmpConfig = configPath(cacheDir) + '.tmp';
  const tmpTree = layerTreePath(cacheDir) + '.tmp';
  try {
    fs.writeFileSync(tmpConfig, JSON.stringify({ model_id: modelId, format: tree.format }, null, 2), 'utf8');
    fs.renameSync(tmpConfig, configPath(cacheDir));
    fs.writeFileSync(tmpTree, JSON.stringify(tree, null, 2), 'utf8');
    fs.renameSync(tmpTree, layerTreePath(cacheDir));
  } catch {
    _deleteCacheFiles(sanitizedId);
    try { fs.rmSync(tmpConfig, { force: true }); } catch { /* ignore */ }
    try { fs.rmSync(tmpTree, { force: true }); } catch { /* ignore */ }
    return { code: 'inspection_failed', message: 'Failed to write cache files' };
  }

  return tree;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function deleteCacheFiles(sanitizedId: string): void {
  _deleteCacheFiles(sanitizedId);
}
