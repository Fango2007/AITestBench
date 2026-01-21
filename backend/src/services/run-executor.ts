import { performance } from 'perf_hooks';

import { InferenceServerRecord, getInferenceServerById } from '../models/inference-server.js';
import { getSuiteById } from '../models/suite.js';
import { getLatestTestDefinition } from '../models/test-definition.js';
import { computeMetrics } from './metrics.js';
import { loadPerplexityDataset } from './perplexity.js';
import { parseSseEvents } from './sse-parser.js';
import { logEvent } from './observability.js';

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface RunExecutionRequest {
  run_id: string;
  inference_server_id: string;
  test_id?: string | null;
  suite_id?: string | null;
  profile_id?: string | null;
  profile_version?: string | null;
  max_retries?: number;
  effective_config?: Record<string, unknown> | null;
  abort_signal?: AbortSignal;
}

export interface TestExecutionResult {
  test_id: string;
  verdict: 'pass' | 'fail' | 'skip';
  failure_reason: string | null;
  metrics: Record<string, unknown> | null;
  artefacts: Record<string, unknown> | null;
  raw_events: Record<string, unknown>[] | null;
  started_at: string;
  ended_at: string;
}

export interface RunExecutionResult {
  status: RunStatus;
  started_at: string;
  ended_at: string;
  failure_reason?: string;
  results: TestExecutionResult[];
}

interface Assertion {
  type: string;
  target?: string;
  expected?: unknown;
}

function buildAuthHeaders(server: InferenceServerRecord): Record<string, string> {
  const headers: Record<string, string> = {};
  if (server.auth.type === 'none') {
    return headers;
  }
  const tokenEnv = server.auth.token_env;
  const token = tokenEnv ? process.env[tokenEnv] : null;
  if (!token) {
    return headers;
  }
  const headerName = server.auth.header_name || 'Authorization';
  if (server.auth.type === 'bearer' || server.auth.type === 'oauth') {
    headers[headerName] = `Bearer ${token}`;
    return headers;
  }
  if (server.auth.type === 'basic') {
    headers[headerName] = `Basic ${token}`;
    return headers;
  }
  headers[headerName] = token;
  return headers;
}

function replacePlaceholders(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === 'string') {
    let output = value;
    for (const [key, replacement] of Object.entries(replacements)) {
      output = output.split(`{${key}}`).join(replacement);
    }
    return output;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replacePlaceholders(entry, replacements));
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      replacePlaceholders(entry, replacements)
    ]);
    return Object.fromEntries(entries);
  }
  return value;
}

function pickModelParams(input: Record<string, unknown> | null): Record<string, unknown> {
  if (!input) {
    return {};
  }
  const allowedKeys = [
    'model',
    'messages',
    'prompt',
    'temperature',
    'top_p',
    'top_k',
    'max_tokens',
    'max_completion_tokens',
    'stream',
    'seed',
    'presence_penalty',
    'frequency_penalty',
    'repetition_penalty',
    'stop',
    'tools',
    'tool_choice'
  ];
  const output: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in input) {
      output[key] = input[key];
    }
  }
  return output;
}

function getJsonPath(data: unknown, path: string): unknown {
  if (!path.startsWith('$.')) {
    return undefined;
  }
  const parts = path
    .slice(2)
    .split('.')
    .flatMap((segment) => segment.split(/\[(\d+)\]/).filter(Boolean));

  let current: any = data;
  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    if (/^\d+$/.test(part)) {
      current = current[Number(part)];
    } else {
      current = current[part];
    }
  }
  return current;
}

function evaluateAssertions(
  assertions: Assertion[],
  response: {
    status: number;
    body: unknown;
    text: string;
    events: Array<Record<string, unknown>>;
  }
): { verdict: 'pass' | 'fail'; failures: string[] } {
  const failures: string[] = [];

  for (const assertion of assertions) {
    const type = assertion.type;
    if (type === 'json_path_exists') {
      const value = getJsonPath(response.body, String(assertion.expected));
      if (value === undefined) {
        failures.push(`Missing json path: ${assertion.expected}`);
      }
      continue;
    }

    if (type === 'contains') {
      const expected = String(assertion.expected ?? '');
      if (!response.text.includes(expected)) {
        failures.push(`Missing text: ${expected}`);
      }
      continue;
    }

    if (type === 'status_code_in') {
      const list = Array.isArray(assertion.expected) ? assertion.expected : [];
      if (!list.includes(response.status)) {
        failures.push(`Unexpected status: ${response.status}`);
      }
      continue;
    }

    failures.push(`Unsupported assertion: ${type}`);
  }

  return {
    verdict: failures.length > 0 ? 'fail' : 'pass',
    failures
  };
}

async function executeHttpTest(
  targetBaseUrl: string,
  requestTemplate: Record<string, unknown> | null,
  assertions: Assertion[],
  effectiveConfig: Record<string, unknown> | null,
  authHeaders: Record<string, string>,
  abortSignal?: AbortSignal
): Promise<Omit<TestExecutionResult, 'test_id'>> {
  const startedAtIso = new Date().toISOString();
  const requestStarted = performance.now();
  const template = requestTemplate ?? {};
  const path = String(template.path ?? '/v1/chat/completions');
  const method = String(template.method ?? 'POST');
  const bodyTemplate = (template.body_template as Record<string, unknown>) ?? {};
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(template.headers as Record<string, string> | undefined),
    ...authHeaders
  };

  const mergedBody = {
    ...bodyTemplate,
    ...pickModelParams(effectiveConfig)
  };
  if (effectiveConfig?.model) {
    mergedBody.model = effectiveConfig.model;
  }

  const url = new URL(path, targetBaseUrl);
  const controller = new AbortController();
  const timeoutMs = Number((effectiveConfig?.request_timeout_sec as number | undefined) ?? 30) * 1000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = () => controller.abort();
  if (abortSignal) {
    if (abortSignal.aborted) {
      controller.abort();
    } else {
      abortSignal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  let responseText = '';
  let responseBody: unknown = null;
  let firstTokenAt: number | null = null;
  let events: Array<Record<string, unknown>> = [];

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: JSON.stringify(mergedBody),
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (!firstTokenAt) {
          firstTokenAt = performance.now();
        }
        responseText += decoder.decode(value, { stream: true });
      }
      responseText += decoder.decode();
    } else {
      responseText = await response.text();
    }

    if (contentType.includes('application/json')) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    } else {
      responseBody = responseText;
    }

    if (contentType.includes('text/event-stream')) {
      const parsed = parseSseEvents(responseText);
      events = parsed
        .filter((event) => event.type === 'data')
        .map((event) => {
          try {
            return JSON.parse(event.payload ?? '{}') as Record<string, unknown>;
          } catch {
            return { raw: event.payload } as Record<string, unknown>;
          }
        });
    }

    const completedAt = performance.now();
    const metrics = computeMetrics({
      request_started_at: requestStarted,
      first_token_at: firstTokenAt ?? undefined,
      completed_at: completedAt
    });

    const assertionResult = evaluateAssertions(assertions, {
      status: response.status,
      body: responseBody,
      text: responseText,
      events
    });

    return {
      verdict: assertionResult.verdict,
      failure_reason: assertionResult.failures.length ? assertionResult.failures.join('; ') : null,
      metrics,
      artefacts: {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        response_preview: responseText.slice(0, 500),
        response_body: responseText
      },
      raw_events: events.length > 0 ? events : null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString()
    };
  } catch (error) {
    if (abortSignal?.aborted) {
      return {
        verdict: 'skip',
        failure_reason: 'Canceled',
        metrics: null,
        artefacts: null,
        raw_events: null,
        started_at: startedAtIso,
        ended_at: new Date().toISOString()
      };
    }
    const isTimeout =
      error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'));
    const message = isTimeout ? 'Timeout' : error instanceof Error ? error.message : 'Request failed';
    return {
      verdict: 'fail',
      failure_reason: message,
      metrics: null,
      artefacts: null,
      raw_events: null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString()
    };
  } finally {
    clearTimeout(timeout);
    if (abortSignal) {
      abortSignal.removeEventListener('abort', abortHandler);
    }
  }
}

async function executeProxyPerplexityTest(
  targetBaseUrl: string,
  requestTemplate: Record<string, unknown> | null,
  assertions: Assertion[],
  effectiveConfig: Record<string, unknown> | null,
  authHeaders: Record<string, string>,
  abortSignal?: AbortSignal
): Promise<Omit<TestExecutionResult, 'test_id'>> {
  const startedAtIso = new Date().toISOString();
  if (abortSignal?.aborted) {
    return {
      verdict: 'skip',
      failure_reason: 'Canceled',
      metrics: null,
      artefacts: null,
      raw_events: null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString()
    };
  }
  const datasetPath = process.env.AITESTBENCH_PROXY_PERPLEXITY_DATASET;
  if (!datasetPath) {
    return {
      verdict: 'fail',
      failure_reason: 'Proxy perplexity dataset path not configured.',
      metrics: null,
      artefacts: null,
      raw_events: null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString()
    };
  }

  let items = [];
  try {
    items = loadPerplexityDataset(datasetPath);
  } catch (error) {
    return {
      verdict: 'fail',
      failure_reason: error instanceof Error ? error.message : 'Unable to load proxy perplexity dataset.',
      metrics: null,
      artefacts: null,
      raw_events: null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString()
    };
  }

  if (items.length === 0) {
    return {
      verdict: 'fail',
      failure_reason: 'Proxy perplexity dataset is empty.',
      metrics: null,
      artefacts: null,
      raw_events: null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString()
    };
  }

  let correct = 0;
  const failures: string[] = [];

  for (const item of items) {
    if (abortSignal?.aborted) {
      return {
        verdict: 'skip',
        failure_reason: 'Canceled',
        metrics: null,
        artefacts: null,
        raw_events: null,
        started_at: startedAtIso,
        ended_at: new Date().toISOString()
      };
    }
    const replacements = {
      prompt: item.prompt,
      correct: item.correct
    };
    const replacedTemplate = replacePlaceholders(requestTemplate, replacements) as Record<string, unknown> | null;
    const replacedAssertions = replacePlaceholders(assertions, replacements) as Assertion[];
    const result = await executeHttpTest(
      targetBaseUrl,
      replacedTemplate,
      replacedAssertions,
      effectiveConfig,
      authHeaders,
      abortSignal
    );
    if (result.verdict === 'pass') {
      correct += 1;
    } else if (result.failure_reason) {
      failures.push(result.failure_reason);
    }
  }

  const total = items.length;
  const accuracy = total > 0 ? correct / total : 0;
  const verdict = correct === total ? 'pass' : 'fail';

  return {
    verdict,
    failure_reason: verdict === 'pass' ? null : `Proxy accuracy ${correct}/${total}`,
    metrics: {
      proxy_accuracy: accuracy,
      proxy_total: total,
      proxy_correct: correct
    },
    artefacts: {
      proxy_accuracy: accuracy,
      proxy_total: total,
      proxy_correct: correct,
      failure_samples: failures.slice(0, 3)
    },
    raw_events: null,
    started_at: startedAtIso,
    ended_at: new Date().toISOString()
  };
}

export async function executeRun(request: RunExecutionRequest): Promise<RunExecutionResult> {
  const startedAt = new Date().toISOString();
  const dryRun = process.env.AITESTBENCH_DRY_RUN === '1' || process.env.NODE_ENV === 'test';
  const abortSignal = request.abort_signal;

  const server = getInferenceServerById(request.inference_server_id);
  if (!server) {
    return {
      status: 'failed',
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      failure_reason: 'Inference server not found',
      results: []
    };
  }

  let testIds: string[] = [];
  if (request.test_id) {
    testIds = [request.test_id];
  } else if (request.suite_id) {
    const suite = getSuiteById(request.suite_id);
    if (!suite) {
      return {
        status: 'failed',
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        failure_reason: 'Suite not found',
        results: []
      };
    }
    testIds = suite.ordered_test_ids;
  }

  if (testIds.length === 0) {
    return {
      status: 'failed',
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      failure_reason: 'No tests provided',
      results: []
    };
  }

  const results: TestExecutionResult[] = [];

  for (const testId of testIds) {
    if (abortSignal?.aborted) {
      return {
        status: 'canceled',
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        failure_reason: 'Canceled',
        results
      };
    }
    const definition = getLatestTestDefinition(testId);
    if (!definition) {
      results.push({
        test_id: testId,
        verdict: 'fail',
        failure_reason: 'Test definition not found',
        metrics: null,
        artefacts: null,
        raw_events: null,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString()
      });
      continue;
    }

    if (dryRun) {
      results.push({
        test_id: testId,
        verdict: 'skip',
        failure_reason: 'Dry run',
        metrics: null,
        artefacts: null,
        raw_events: null,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString()
      });
      continue;
    }

    logEvent({
      level: 'info',
      message: 'Executing test against inference server',
      run_id: request.run_id,
      test_id: testId
    });

    const authHeaders = buildAuthHeaders(server);
    const usesProxyPerplexity = definition.protocols?.includes('proxy_perplexity');
    const result = usesProxyPerplexity
      ? await executeProxyPerplexityTest(
          server.endpoints.base_url,
          definition.request_template,
          definition.assertions as Assertion[],
          request.effective_config ?? null,
          authHeaders,
          abortSignal
        )
      : await executeHttpTest(
          server.endpoints.base_url,
          definition.request_template,
          definition.assertions as Assertion[],
          request.effective_config ?? null,
          authHeaders,
          abortSignal
        );

    results.push({
      test_id: testId,
      ...result
    });
  }

  const status = results.some((result) => result.verdict === 'fail') ? 'failed' : 'completed';
  const finalStatus = abortSignal?.aborted ? 'canceled' : status;

  return {
    status: finalStatus,
    started_at: startedAt,
    ended_at: new Date().toISOString(),
    results
  };
}
