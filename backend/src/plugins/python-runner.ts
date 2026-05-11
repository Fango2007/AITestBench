import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { resolveInferenceProxyConfig } from '../services/inference-proxy.js';

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

export interface PythonEntrypointOptions extends PythonRunOptions {
  modulePath: string;
  entrypoint: string;
  spec: Record<string, unknown>;
  context: Record<string, unknown>;
}

export interface PythonEntrypointResult extends PythonRunResult {
  output: Record<string, unknown> | null;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function resolvePythonBin(): string {
  const configured = process.env.INFERHARNESS_PYTHON_BIN?.trim();
  if (configured && configured.length > 0) {
    if (!fs.existsSync(configured)) {
      throw new Error(`Configured python binary not found: ${configured}`);
    }
    return configured;
  }
  return 'python3';
}

function buildUlimitPrefix(cpuSeconds: number, memoryMb: number): string {
  const parts = [`ulimit -t ${cpuSeconds}`];
  if (process.platform === 'linux') {
    const memoryKb = Math.floor(memoryMb * 1024);
    parts.push(`ulimit -v ${memoryKb}`);
  }
  return parts.join(' && ');
}

function ensureAllowedPath(modulePath: string, allowedRoots: string[]): string {
  const resolved = fs.realpathSync(modulePath);
  const allowed = allowedRoots.map((root) => fs.realpathSync(root));
  if (!allowed.some((root) => resolved.startsWith(root + path.sep) || resolved === root)) {
    throw new Error(`Python test path not allowed: ${resolved}`);
  }
  return resolved;
}

export function buildPythonProcessEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  overrides?: Record<string, string>
): NodeJS.ProcessEnv {
  const env = { ...baseEnv, ...(overrides ?? {}) };
  const proxyConfig = resolveInferenceProxyConfig(env);
  if (!proxyConfig) {
    return env;
  }

  env.HTTP_PROXY = env.HTTP_PROXY || proxyConfig.proxy;
  env.http_proxy = env.http_proxy || proxyConfig.proxy;
  env.HTTPS_PROXY = env.HTTPS_PROXY || proxyConfig.proxy;
  env.https_proxy = env.https_proxy || proxyConfig.proxy;

  if (proxyConfig.noProxy) {
    env.NO_PROXY = env.NO_PROXY || proxyConfig.noProxy;
    env.no_proxy = env.no_proxy || proxyConfig.noProxy;
  }

  return env;
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
    const pythonBin = resolvePythonBin();

    const command = [
      buildUlimitPrefix(cpuSeconds, memoryMb),
      `${shellEscape(pythonBin)} ${shellEscape(resolvedPath)}`
    ].join(' && ');

    const proc = spawn('bash', ['-lc', command], {
      env: buildPythonProcessEnv(process.env, options.env),
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

function buildRunnerScript(): string {
  return [
    'import json',
    'import sys',
    'import time',
    'import hashlib',
    'import urllib.request',
    'import urllib.parse',
    'import importlib.util',
    'import os',
    '',
    'module_path = sys.argv[1]',
    'entrypoint_name = sys.argv[2]',
    'spec_path = sys.argv[3]',
    'context_path = sys.argv[4]',
    'module_dir = os.path.dirname(os.path.abspath(module_path))',
    'if module_dir not in sys.path:',
    '    sys.path.insert(0, module_dir)',
    '',
    'with open(spec_path, "r", encoding="utf-8") as f:',
    '    spec = json.load(f)',
    'with open(context_path, "r", encoding="utf-8") as f:',
    '    ctx_data = json.load(f)',
    '',
    'def _get_path(data, path):',
    '    current = data',
    '    for part in path.split("."):',
    '        if not isinstance(current, dict):',
    '            return None',
    '        if part not in current:',
    '            return None',
    '        current = current.get(part)',
    '    return current',
    '',
    'def _render_str(value):',
    '    out = value',
    '    while True:',
    '        start = out.find("{{")',
    '        if start == -1:',
    '            break',
    '        end = out.find("}}", start)',
    '        if end == -1:',
    '            break',
    '        token = out[start + 2:end].strip()',
    '        replacement = None',
    '        if token.startswith("profile."):',
    '            replacement = _get_path(ctx_data.get("profile", {}), token[len("profile."):])',
    '        elif token.startswith("env."):',
    '            replacement = _get_path(ctx_data.get("env", {}), token[len("env."):])',
    '        elif token.startswith("vars."):',
    '            replacement = _get_path(ctx_data.get("vars", {}), token[len("vars."):])',
    '        if replacement is None:',
    '            replacement = ""',
    '        out = out[:start] + str(replacement) + out[end + 2:]',
    '    return out',
    '',
    'def render(obj):',
    '    if isinstance(obj, str):',
    '        return _render_str(obj)',
    '    if isinstance(obj, list):',
    '        return [render(item) for item in obj]',
    '    if isinstance(obj, dict):',
    '        return {key: render(value) for key, value in obj.items()}',
    '    return obj',
    '',
    'class Logger:',
    '    def info(self, *args, **kwargs):',
    '        return None',
    '    def debug(self, *args, **kwargs):',
    '        return None',
    '    def warn(self, *args, **kwargs):',
    '        return None',
    '    def error(self, *args, **kwargs):',
    '        return None',
    '',
    'class Response:',
    '    def __init__(self, status, headers, body, text, metrics, stream=None):',
    '        self.status = status',
    '        self.headers = headers',
    '        self.body = body',
    '        self.text = text',
    '        self.stream = stream',
    '        self.metrics = metrics',
    '',
    'class HttpClient:',
    '    def __init__(self):',
    '        self.steps = []',
    '    def request(self, method, url, headers=None, query=None, json=None, timeout_ms=None, stream=False, transport=None):',
    '        started_at = time.time()',
    '        body_bytes = b""',
    '        req_headers = headers or {}',
    '        if json is not None:',
    '            body_bytes = json_module.dumps(json).encode("utf-8")',
    '            if "content-type" not in {k.lower(): v for k, v in req_headers.items()}:',
    '                req_headers["content-type"] = "application/json"',
    '        if query:',
    '            qs = urllib.parse.urlencode(query)',
    '            sep = "&" if "?" in url else "?"',
    '            url = f"{url}{sep}{qs}"',
    '        req = urllib.request.Request(url, data=body_bytes or None, method=str(method).upper())',
    '        for k, v in (req_headers or {}).items():',
    '            req.add_header(k, v)',
    '        t0 = time.perf_counter()',
    '        try:',
    '            with urllib.request.urlopen(req, timeout=(timeout_ms or 60000) / 1000.0) as resp:',
    '                resp_bytes = resp.read()',
    '                t1 = time.perf_counter()',
    '                status = resp.getcode() or 0',
    '                resp_headers = dict(resp.headers.items())',
    '                text = None',
    '                body = None',
    '                content_type = resp_headers.get("Content-Type", "")',
    '                decoded = resp_bytes.decode("utf-8", errors="replace")',
    '                if "application/json" in content_type:',
    '                    try:',
    '                        body = json_module.loads(decoded)',
    '                    except Exception:',
    '                        body = None',
    '                        text = decoded',
    '                else:',
    '                    text = decoded',
    '                total_ms = (t1 - t0) * 1000.0',
    '                metrics = {',
    '                    "ttfb_ms": total_ms,',
    '                    "total_ms": total_ms,',
    '                    "bytes_in": len(resp_bytes),',
    '                    "bytes_out": len(body_bytes),',
    '                    "tokens_in": None,',
    '                    "tokens_out": None,',
    '                    "tok_s": None',
    '                }',
    '                request_snapshot = {',
    '                    "method": str(method).upper(),',
    '                    "url": url,',
    '                    "headers": req_headers,',
    '                    "query": query if isinstance(query, dict) else None,',
    '                    "body": json if json is not None else None,',
    '                    "body_sha256": hashlib.sha256(body_bytes).hexdigest() if body_bytes else None,',
    '                    "transport": {"stream": bool(stream), "format": None},',
    '                    "timeout_ms": timeout_ms',
    '                }',
    '                response_snapshot = {',
    '                    "status": status,',
    '                    "headers": resp_headers,',
    '                    "body": body,',
    '                    "text": text,',
    '                    "body_sha256": hashlib.sha256(resp_bytes).hexdigest() if resp_bytes else None,',
    '                    "stream": None,',
    '                    "metrics": metrics',
    '                }',
    '                step = {',
    '                    "index": len(self.steps),',
    '                    "name": None,',
    '                    "status": "pass",',
    '                    "attempts": 1,',
    '                    "request": request_snapshot,',
    '                    "response": response_snapshot,',
    '                    "extract": [],',
    '                    "vars_delta": {},',
    '                    "assertions": [],',
    '                    "metrics": metrics,',
    '                    "timing": {"started_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(started_at)), "ended_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())},',
    '                    "error": None,',
    '                    "notes": None',
    '                }',
    '                self.steps.append(step)',
    '                return Response(status, resp_headers, body, text, metrics, None)',
    '        except Exception as exc:',
    '            t1 = time.perf_counter()',
    '            total_ms = (t1 - t0) * 1000.0',
    '            metrics = {',
    '                "ttfb_ms": total_ms,',
    '                "total_ms": total_ms,',
    '                "bytes_in": 0,',
    '                "bytes_out": len(body_bytes),',
    '                "tokens_in": None,',
    '                "tokens_out": None,',
    '                "tok_s": None',
    '            }',
    '            request_snapshot = {',
    '                "method": str(method).upper(),',
    '                "url": url,',
    '                "headers": req_headers,',
    '                "query": query if isinstance(query, dict) else None,',
    '                "body": json if json is not None else None,',
    '                "body_sha256": hashlib.sha256(body_bytes).hexdigest() if body_bytes else None,',
    '                "transport": {"stream": bool(stream), "format": None},',
    '                "timeout_ms": timeout_ms',
    '            }',
    '            response_snapshot = {',
    '                "status": 0,',
    '                "headers": {},',
    '                "body": None,',
    '                "text": str(exc),',
    '                "body_sha256": None,',
    '                "stream": None,',
    '                "metrics": metrics',
    '            }',
    '            step = {',
    '                "index": len(self.steps),',
    '                "name": None,',
    '                "status": "error",',
    '                "attempts": 1,',
    '                "request": request_snapshot,',
    '                "response": response_snapshot,',
    '                "extract": [],',
    '                "vars_delta": {},',
    '                "assertions": [],',
    '                "metrics": metrics,',
    '                "timing": {"started_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(started_at)), "ended_at": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())},',
    '                "error": {"code": "http_error", "message": str(exc), "details": None},',
    '                "notes": None',
    '            }',
    '            self.steps.append(step)',
    '            raise',
    '',
    'json_module = json',
    'http_client = HttpClient()',
    '',
    'class Context:',
    '    def __init__(self):',
    '        self.profile = ctx_data.get("profile", {})',
    '        self.env = ctx_data.get("env", {})',
    '        self.vars = ctx_data.get("vars", {})',
    '        self.logger = Logger()',
    '        self.http = http_client',
    '    def render(self, obj):',
    '        return render(obj)',
    '',
    'ctx = Context()',
    '',
    'spec = render(spec)',
    'params = spec.get("parameters", {})',
    '',
    'spec_obj = importlib.util.spec_from_file_location("python_test_module", module_path)',
    'module = importlib.util.module_from_spec(spec_obj)',
    'spec_obj.loader.exec_module(module)  # type: ignore',
    'entrypoint = getattr(module, entrypoint_name)',
    '',
    'result = entrypoint(ctx, params)',
    '',
    'payload = {',
    '    "result": result,',
    '    "steps": http_client.steps',
    '}',
    'print(json.dumps(payload))'
  ].join('\n');
}

export function runPythonEntrypoint(options: PythonEntrypointOptions): Promise<PythonEntrypointResult> {
  return new Promise((resolve, reject) => {
    const allowedPaths = options.allowedPaths ?? [process.cwd()];
    let resolvedModule: string;

    try {
      resolvedModule = ensureAllowedPath(options.modulePath, allowedPaths);
    } catch (err) {
      reject(err);
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inferharness-python-'));
    const specPath = path.join(tmpDir, 'spec.json');
    const contextPath = path.join(tmpDir, 'context.json');
    const runnerPath = path.join(tmpDir, 'runner.py');
    fs.writeFileSync(specPath, JSON.stringify(options.spec, null, 2), 'utf8');
    fs.writeFileSync(contextPath, JSON.stringify(options.context, null, 2), 'utf8');
    fs.writeFileSync(runnerPath, buildRunnerScript(), 'utf8');

    const cpuSeconds = options.cpuSeconds ?? 60;
    const memoryMb = options.memoryMb ?? 512;
    const pythonBin = resolvePythonBin();

    const command = [
      buildUlimitPrefix(cpuSeconds, memoryMb),
      `${shellEscape(pythonBin)} ${shellEscape(runnerPath)} ${shellEscape(resolvedModule)} ${shellEscape(options.entrypoint)} ${shellEscape(specPath)} ${shellEscape(contextPath)}`
    ].join(' && ');

    const proc = spawn('bash', ['-lc', command], {
      env: buildPythonProcessEnv(process.env, options.env),
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
      let output: Record<string, unknown> | null = null;
      if (stdout.trim().length > 0) {
        try {
          output = JSON.parse(stdout) as Record<string, unknown>;
        } catch {
          output = null;
        }
      }
      resolve({ stdout, stderr, exitCode: code ?? 0, output });
    });
  });
}
