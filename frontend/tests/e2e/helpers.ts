import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const API_BASE_URL =
  env.E2E_API_BASE_URL ??
  env.AITESTBENCH_API_BASE_URL ??
  env.VITE_AITESTBENCH_API_BASE_URL ??
  'http://localhost:8080';
const API_TOKEN = env.AITESTBENCH_API_TOKEN ?? env.VITE_AITESTBENCH_API_TOKEN;
const authHeaders = API_TOKEN ? { 'x-api-token': API_TOKEN } : undefined;

export interface InferenceServerRecord {
  inference_server: {
    server_id: string;
    display_name: string;
  };
  endpoints: {
    base_url: string;
  };
  runtime: {
    api: {
      schema_family: string[];
    };
  };
}

async function parseJsonResponse<T>(response: APIResponse, label: string): Promise<T> {
  const contentType = response.headers()['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    const body = await response.text();
    throw new Error(`${label} expected JSON but received ${contentType || 'unknown'}: ${body.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

export async function createInferenceServer(
  request: APIRequestContext,
  overrides?: Partial<{ display_name: string; base_url: string; schema_family: string[] }>
) {
  const payload = {
    inference_server: { display_name: overrides?.display_name ?? `E2E Server ${Date.now()}` },
    endpoints: { base_url: overrides?.base_url ?? 'http://localhost:11434' },
    runtime: { api: { schema_family: overrides?.schema_family ?? ['openai-compatible'], api_version: null } }
  };
  const response = await request.post(`${API_BASE_URL}/inference-servers`, {
    data: payload,
    headers: authHeaders
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`createInferenceServer failed: ${response.status()} ${body}`);
  }
  return parseJsonResponse<InferenceServerRecord>(response, 'createInferenceServer');
}

export async function listInferenceServers(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/inference-servers`, {
    headers: authHeaders
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`listInferenceServers failed: ${response.status()} ${body}`);
  }
  return parseJsonResponse<InferenceServerRecord[]>(response, 'listInferenceServers');
}

export async function findInferenceServerByName(request: APIRequestContext, name: string) {
  const servers = await listInferenceServers(request);
  return servers.find((server) => server.inference_server.display_name === name) ?? null;
}

export async function archiveInferenceServer(request: APIRequestContext, id: string) {
  const response = await request.post(`${API_BASE_URL}/inference-servers/${id}/archive`, {
    headers: authHeaders
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`archiveInferenceServer failed: ${response.status()} ${body}`);
  }
}
