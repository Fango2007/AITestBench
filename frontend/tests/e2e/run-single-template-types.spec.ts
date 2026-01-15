import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';

import { archiveInferenceServer, createInferenceServer } from './helpers.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const API_BASE_URL =
  env.E2E_API_BASE_URL ?? env.VITE_AITESTBENCH_API_BASE_URL ?? 'http://localhost:8080';
const API_TOKEN = env.AITESTBENCH_API_TOKEN ?? env.VITE_AITESTBENCH_API_TOKEN;
const authHeaders = API_TOKEN ? { 'x-api-token': API_TOKEN } : undefined;

function buildJsonTemplateContent(id: string, name: string, version = '1.0.0') {
  return JSON.stringify(
    {
      id,
      version,
      name,
      description: 'Template description',
      protocols: [],
      request: { method: 'POST', path: '/v1/chat/completions', body_template: {} },
      assertions: [],
      metrics: {}
    },
    null,
    2
  );
}

test('supports JSON and Python template types', async ({ page, request }) => {
  const server = await createInferenceServer(request, {
    display_name: `E2E Template Type Server ${Date.now()}`
  });
  const jsonTemplateId = `e2e-json-${Date.now()}`;
  const pythonTemplateId = `e2e-python-${Date.now()}`;

  await request.post(`${API_BASE_URL}/templates`, {
    headers: authHeaders,
    data: {
      id: jsonTemplateId,
      name: 'JSON Template',
      type: 'json',
      version: '1.0.0',
      content: buildJsonTemplateContent(jsonTemplateId, 'JSON Template')
    }
  });

  await request.post(`${API_BASE_URL}/templates`, {
    headers: authHeaders,
    data: {
      id: pythonTemplateId,
      name: 'Python Template',
      type: 'python',
      version: '1.0.0',
      content: 'print(\"hello\")'
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page.getByRole('heading', { name: 'Run Single Test' })).toBeVisible();

  await page.getByLabel('Inference server', { exact: true }).selectOption(server.inference_server.server_id);
  await page.getByLabel('Model').fill('gpt-4o-mini');
  await page.getByLabel('Templates').selectOption([jsonTemplateId, pythonTemplateId]);
  await page.getByRole('button', { name: 'Generate Active Tests' }).click();

  await expect(page.getByText('Sandbox ready')).toBeVisible();
  await expect(page.getByText('Runnable Command Preview')).toBeVisible();

  const listActive = await request.get(`${API_BASE_URL}/active-tests`, { headers: authHeaders });
  if (listActive.ok()) {
    const activeTests = (await listActive.json()) as Array<{ id: string; template_id: string }>;
    for (const active of activeTests.filter((entry) =>
      [jsonTemplateId, pythonTemplateId].includes(entry.template_id)
    )) {
      await request.delete(`${API_BASE_URL}/active-tests/${active.id}`, { headers: authHeaders });
    }
  }

  await request.delete(`${API_BASE_URL}/templates/${jsonTemplateId}`, { headers: authHeaders });
  await request.delete(`${API_BASE_URL}/templates/${pythonTemplateId}`, { headers: authHeaders });
  await archiveInferenceServer(request, server.inference_server.server_id);
});
