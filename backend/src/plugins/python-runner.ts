import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface PythonRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface PythonRunOptions {
  timeoutMs: number;
  cpuSeconds?: number;
  memoryMb?: number;
  allowedPaths?: string[];
  env?: Record<string, string>;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function ensureAllowedPath(modulePath: string, allowedRoots: string[]): string {
  const resolved = fs.realpathSync(modulePath);
  const allowed = allowedRoots.map((root) => fs.realpathSync(root));
  if (!allowed.some((root) => resolved.startsWith(root + path.sep) || resolved === root)) {
    throw new Error(`Python test path not allowed: ${resolved}`);
  }
  return resolved;
}

export function runPythonModule(
  modulePath: string,
  options: PythonRunOptions
): Promise<PythonRunResult> {
  return new Promise((resolve, reject) => {
    const allowedPaths = options.allowedPaths ?? [process.cwd()];
    let resolvedPath: string;

    try {
      resolvedPath = ensureAllowedPath(modulePath, allowedPaths);
    } catch (err) {
      reject(err);
      return;
    }

    const cpuSeconds = options.cpuSeconds ?? 60;
    const memoryMb = options.memoryMb ?? 512;
    const memoryKb = Math.floor(memoryMb * 1024);

    const command = [
      `ulimit -t ${cpuSeconds}`,
      `ulimit -v ${memoryKb}`,
      `python3 ${shellEscape(resolvedPath)}`
    ].join(' && ');

    const proc = spawn('bash', ['-lc', command], {
      env: { ...process.env, ...options.env },
      cwd: allowedPaths[0]
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('Python test timed out'));
    }, options.timeoutMs);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}
