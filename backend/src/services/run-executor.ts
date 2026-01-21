import crypto from 'crypto';
import { performance } from 'perf_hooks';

import { InferenceServerRecord, getInferenceServerById } from '../models/inference-server.js';
import { getSuiteById } from '../models/suite.js';
import { getLatestTestDefinition } from '../models/test-definition.js';
import { computeMetrics, MetricResult } from './metrics.js';
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
  step_results: StepResultSnapshot[];
}

export interface RunExecutionResult {
  status: RunStatus;
  started_at: string;
  ended_at: string;
  failure_reason?: string;
  results: TestExecutionResult[];
}

export type StepStatus = 'pass' | 'fail' | 'error' | 'skipped';

export interface RequestSnapshot {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  query: Record<string, string> | null;
  body: unknown;
  body_sha256: string | null;
  transport: { stream: boolean; format: 'sse' | 'jsonl' | 'chunked' | 'unknown' | null } | null;
  timeout_ms: number | null;
}

export interface StreamEventSnapshot {
  raw: string;
  json: Record<string, unknown> | unknown[] | null;
  done: boolean;
  seq: number | null;
}

export interface MetricsSnapshot {
  ttfb_ms: number;
  total_ms: number;
  bytes_in: number | null;
  bytes_out: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  tok_s: number | null;
}

export interface NormalisedResponseSnapshot {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown> | unknown[] | null;
  text: string | null;
  body_sha256: string | null;
  stream: { format: 'sse' | 'jsonl' | 'chunked' | 'unknown'; events: StreamEventSnapshot[]; done: boolean } | null;
  metrics: MetricsSnapshot;
}

export interface AssertionOutcomeDraft {
  type: string | null;
  target: 'status' | 'headers' | 'body' | 'text' | 'stream' | 'metrics' | 'vars';
  selector: string | null;
  op: string;
  expected: unknown;
  actual: unknown;
  severity: 'error' | 'warn';
  when: string | null;
  passed: boolean;
  message: string | null;
}

export interface StepErrorSnapshot {
  code: 'timeout' | 'connection_error' | 'http_error' | 'templating_error' | 'assertion_failed' | 'schema_error' | 'unknown';
  message: string;
  details: Record<string, unknown> | null;
}

export interface StepResultSnapshot {
  index: number;
  name: string | null;
  status: StepStatus;
  attempts: number;
  request: RequestSnapshot;
  response: NormalisedResponseSnapshot;
  extract: Array<Record<string, unknown>>;
  vars_delta: Record<string, unknown> | null;
  assertions: AssertionOutcomeDraft[];
  metrics: MetricsSnapshot;
  timing: { started_at: string | null; ended_at: string | null };
  error: StepErrorSnapshot | null;
  notes: string | null;
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
    events: Array<Record<string, unknown>> | StreamEventSnapshot[];
  }
): { verdict: 'pass' | 'fail'; failures: string[]; outcomes: AssertionOutcomeDraft[] } {
  const failures: string[] = [];
  const outcomes: AssertionOutcomeDraft[] = [];

  for (const [index, assertion] of assertions.entries()) {
    const type = assertion.type;
    const outcome: AssertionOutcomeDraft = {
      type,
      target: 'text',
      selector: null,
      op: type,
      expected: assertion.expected ?? null,
      actual: null,
      severity: 'error',
      when: null,
      passed: true,
      message: null
    };

    if (type === 'json_path_exists') {
      outcome.target = 'body';
      outcome.op = 'exists';
      outcome.selector = String(assertion.expected ?? '');
      const value = getJsonPath(response.body, outcome.selector);
      outcome.actual = value ?? null;
      if (value === undefined) {
        outcome.passed = false;
        outcome.message = `Missing json path: ${outcome.selector}`;
        failures.push(outcome.message);
      }
      outcomes.push(outcome);
      continue;
    }

    if (type === 'contains') {
      outcome.target = 'text';
      outcome.op = 'contains';
      const expected = String(assertion.expected ?? '');
      outcome.expected = expected;
      outcome.actual = response.text;
      if (!response.text.includes(expected)) {
        outcome.passed = false;
        outcome.message = `Missing text: ${expected}`;
        failures.push(outcome.message);
      }
      outcomes.push(outcome);
      continue;
    }

    if (type === 'status_code_in') {
      outcome.target = 'status';
      outcome.op = 'in';
      const list = Array.isArray(assertion.expected) ? assertion.expected : [];
      outcome.expected = list;
      outcome.actual = response.status;
      if (!list.includes(response.status)) {
        outcome.passed = false;
        outcome.message = `Unexpected status: ${response.status}`;
        failures.push(outcome.message);
      }
      outcomes.push(outcome);
      continue;
    }

    outcome.passed = false;
    outcome.message = `Unsupported assertion: ${type}`;
    failures.push(outcome.message);
    outcomes.push(outcome);
  }

  return {
    verdict: failures.length > 0 ? 'fail' : 'pass',
    failures,
    outcomes
  };
}

function hashSha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildQuerySnapshot(url: URL): Record<string, string> | null {
  if (url.searchParams.size === 0) {
    return null;
  }
  const entries = Array.from(url.searchParams.entries());
  return Object.fromEntries(entries);
}

function buildMetricsSnapshot(
  metrics: MetricResult,
  requestBodyText: string,
  responseText: string
): MetricsSnapshot {
  const totalMs = typeof metrics.total_ms === 'number' ? metrics.total_ms : 0;
  const ttfbMs =
    typeof metrics.ttfb_ms === 'number' ? metrics.ttfb_ms : totalMs > 0 ? totalMs : 0;
  const bytesOut = requestBodyText ? Buffer.byteLength(requestBodyText) : 0;
  const bytesIn = responseText ? Buffer.byteLength(responseText) : 0;

  return {
    ttfb_ms: ttfbMs,
    total_ms: totalMs,
    bytes_in: bytesIn,
    bytes_out: bytesOut,
    tokens_in: metrics.prompt_tokens ?? null,
    tokens_out: metrics.completion_tokens ?? null,
    tok_s: metrics.tokens_per_sec ?? null
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

  const requestBodyText = JSON.stringify(mergedBody);
  const templateTransport = template.transport as { format?: string } | undefined;
  const transportFormat = templateTransport?.format;
  const normalisedFormat =
    transportFormat === 'sse' || transportFormat === 'jsonl' || transportFormat === 'chunked' || transportFormat === 'unknown'
      ? transportFormat
      : transportFormat
        ? 'unknown'
        : null;
  const requestSnapshot: RequestSnapshot = {
    method: method.toUpperCase() as RequestSnapshot['method'],
    url: url.toString(),
    headers,
    query: buildQuerySnapshot(url),
    body: mergedBody,
    body_sha256: hashSha256(requestBodyText),
    transport: {
      stream: Boolean(mergedBody.stream ?? false),
      format: normalisedFormat
    },
    timeout_ms: timeoutMs
  };

  let responseText = '';
  let responseBody: Record<string, unknown> | unknown[] | null = null;
  let responseStatus = 0;
  let responseHeaders: Record<string, string> = {};
  let firstTokenAt: number | null = null;
  let streamEvents: StreamEventSnapshot[] = [];
  let streamDone = false;
  let stepError: StepErrorSnapshot | null = null;

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: JSON.stringify(mergedBody),
      signal: controller.signal
    });

    responseStatus = response.status;
    responseHeaders = Object.fromEntries(response.headers.entries());
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
        responseBody = JSON.parse(responseText) as Record<string, unknown> | unknown[];
      } catch {
        responseBody = null;
      }
    }

    if (contentType.includes('text/event-stream')) {
      const parsed = parseSseEvents(responseText);
      streamEvents = parsed.map((event, index) => {
        if (event.type === 'done') {
          streamDone = true;
          return { raw: '[DONE]', json: null, done: true, seq: index };
        }
        const raw = event.payload ?? '';
        let parsedJson: Record<string, unknown> | unknown[] | null = null;
        if (raw) {
          try {
            parsedJson = JSON.parse(raw) as Record<string, unknown> | unknown[];
          } catch {
            parsedJson = null;
          }
        }
        return { raw, json: parsedJson, done: false, seq: index };
      });
    }

    const completedAt = performance.now();
    const metrics = computeMetrics({
      request_started_at: requestStarted,
      first_token_at: firstTokenAt ?? undefined,
      completed_at: completedAt
    });
    const schemaMetrics = buildMetricsSnapshot(metrics, requestBodyText, responseText);

    const assertionResult = evaluateAssertions(assertions, {
      status: responseStatus,
      body: responseBody,
      text: responseText,
      events: streamEvents
    });

    const responseSnapshot: NormalisedResponseSnapshot = {
      status: responseStatus,
      headers: responseHeaders,
      body: responseBody,
      text: responseBody ? null : responseText,
      body_sha256: responseText ? hashSha256(responseText) : null,
      stream: contentType.includes('text/event-stream')
        ? { format: 'sse', events: streamEvents, done: streamDone }
        : null,
      metrics: schemaMetrics
    };

    const stepStatus: StepStatus = assertionResult.verdict === 'pass' ? 'pass' : 'fail';
    const step: StepResultSnapshot = {
      index: 0,
      name: null,
      status: stepStatus,
      attempts: 1,
      request: requestSnapshot,
      response: responseSnapshot,
      extract: [],
      vars_delta: null,
      assertions: assertionResult.outcomes,
      metrics: schemaMetrics,
      timing: { started_at: startedAtIso, ended_at: new Date().toISOString() },
      error: null,
      notes: null
    };

    return {
      verdict: assertionResult.verdict,
      failure_reason: assertionResult.failures.length ? assertionResult.failures.join('; ') : null,
      metrics,
      artefacts: {
        status: responseStatus,
        headers: responseHeaders,
        response_preview: responseText.slice(0, 500),
        response_body: responseText
      },
      raw_events:
        streamEvents.length > 0
          ? (streamEvents.map((event) => ({ ...event })) as Record<string, unknown>[])
          : null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString(),
      step_results: [step]
    };
  } catch (error) {
    const completedAt = performance.now();
    const metrics = computeMetrics({
      request_started_at: requestStarted,
      first_token_at: firstTokenAt ?? undefined,
      completed_at: completedAt
    });
    const schemaMetrics = buildMetricsSnapshot(metrics, requestBodyText, responseText);
    const endedAtIso = new Date().toISOString();
    if (abortSignal?.aborted) {
      const responseSnapshot: NormalisedResponseSnapshot = {
        status: responseStatus,
        headers: responseHeaders,
        body: responseBody,
        text: responseText || null,
        body_sha256: responseText ? hashSha256(responseText) : null,
        stream: null,
        metrics: schemaMetrics
      };
      const step: StepResultSnapshot = {
        index: 0,
        name: null,
        status: 'skipped',
        attempts: 1,
        request: requestSnapshot,
        response: responseSnapshot,
        extract: [],
        vars_delta: null,
        assertions: [],
        metrics: schemaMetrics,
        timing: { started_at: startedAtIso, ended_at: endedAtIso },
        error: { code: 'unknown', message: 'Canceled', details: null },
        notes: null
      };
      return {
        verdict: 'skip',
        failure_reason: 'Canceled',
        metrics: null,
        artefacts: null,
        raw_events: null,
        started_at: startedAtIso,
        ended_at: endedAtIso,
        step_results: [step]
      };
    }
    const isTimeout =
      error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'));
    const message = isTimeout ? 'Timeout' : error instanceof Error ? error.message : 'Request failed';
    stepError = {
      code: isTimeout ? 'timeout' : 'connection_error',
      message,
      details: error instanceof Error ? { name: error.name } : null
    };
    const responseSnapshot: NormalisedResponseSnapshot = {
      status: responseStatus,
      headers: responseHeaders,
      body: responseBody,
      text: responseText || null,
      body_sha256: responseText ? hashSha256(responseText) : null,
      stream: null,
      metrics: schemaMetrics
    };
    const step: StepResultSnapshot = {
      index: 0,
      name: null,
      status: 'error',
      attempts: 1,
      request: requestSnapshot,
      response: responseSnapshot,
      extract: [],
      vars_delta: null,
      assertions: [],
      metrics: schemaMetrics,
      timing: { started_at: startedAtIso, ended_at: endedAtIso },
      error: stepError,
      notes: null
    };
    return {
      verdict: 'fail',
      failure_reason: message,
      metrics: null,
      artefacts: null,
      raw_events: null,
      started_at: startedAtIso,
      ended_at: endedAtIso,
      step_results: [step]
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
  const stepResults: StepResultSnapshot[] = [];
  if (abortSignal?.aborted) {
    return {
      verdict: 'skip',
      failure_reason: 'Canceled',
      metrics: null,
      artefacts: null,
      raw_events: null,
      started_at: startedAtIso,
      ended_at: new Date().toISOString(),
      step_results: []
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
      ended_at: new Date().toISOString(),
      step_results: []
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
      ended_at: new Date().toISOString(),
      step_results: []
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
      ended_at: new Date().toISOString(),
      step_results: []
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
        ended_at: new Date().toISOString(),
        step_results: stepResults
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
    for (const step of result.step_results) {
      stepResults.push({
        ...step,
        index: stepResults.length
      });
    }
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
    ended_at: new Date().toISOString(),
    step_results: stepResults
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
        ended_at: new Date().toISOString(),
        step_results: []
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
        ended_at: new Date().toISOString(),
        step_results: []
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
