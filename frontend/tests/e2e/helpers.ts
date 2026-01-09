import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APIRequestContext, expect } from '@playwright/test';
import { loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const API_BASE_URL =
  env.E2E_API_BASE_URL ??
  env.VITE_AITESTBENCH_API_BASE_URL ??
  'http://localhost:8080';
const API_TOKEN = env.AITESTBENCH_API_TOKEN ?? env.VITE_AITESTBENCH_API_TOKEN;
const authHeaders = API_TOKEN ? { 'x-api-token': API_TOKEN } : undefined;

export interface TargetRecord {
  id: string;
  name: string;
  base_url: string;
  provider: string;
}

export async function createTarget(
  request: APIRequestContext,
  overrides?: Partial<Pick<TargetRecord, 'name' | 'base_url' | 'provider'>>
) {
  const payload = {
    name: overrides?.name ?? `E2E Target ${Date.now()}`,
    base_url: overrides?.base_url ?? 'http://localhost:11434',
    provider: overrides?.provider ?? 'openai'
  };
  const response = await request.post(`${API_BASE_URL}/targets`, {
    data: payload,
    headers: authHeaders
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`createTarget failed: ${response.status()} ${body}`);
  }
  return (await response.json()) as TargetRecord;
}

export async function listTargets(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/targets?status=all`, {
    headers: authHeaders
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`listTargets failed: ${response.status()} ${body}`);
  }
  return (await response.json()) as TargetRecord[];
}

export async function findTargetByName(request: APIRequestContext, name: string) {
  const targets = await listTargets(request);
  return targets.find((target) => target.name === name) ?? null;
}

export async function deleteTarget(request: APIRequestContext, id: string) {
  const response = await request.delete(`${API_BASE_URL}/targets/${id}`, {
    headers: authHeaders
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`deleteTarget failed: ${response.status()} ${body}`);
  }
}
