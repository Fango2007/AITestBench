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

test('instantiates templates in Run', async ({ page, request }) => {
  const server = await createInferenceServer(request, {
    display_name: `E2E Template Server ${Date.now()}`
  });
  const templateId = `e2e-template-${Date.now()}`;
  const templateName = 'E2E Template Run';

  const templateResponse = await request.post(`${API_BASE_URL}/templates`, {
    headers: authHeaders,
    data: {
      id: templateId,
      name: templateName,
      type: 'json',
      version: '1.0.0',
      content: buildJsonTemplateContent(templateId, templateName)
    }
  });
  expect(templateResponse.ok()).toBeTruthy();

  await page.goto('/');
  await page.getByRole('button', { name: 'Run' }).click();

  await page.getByLabel('Inference server').selectOption(server.inference_server.server_id);
  await page.getByLabel('Model').fill('gpt-4o-mini');
  await page.getByLabel('Templates').selectOption(templateId);
  await page.getByRole('button', { name: 'Generate Active Tests' }).click();

  await expect(page.getByText(templateName)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled();

  const listActive = await request.get(`${API_BASE_URL}/active-tests`, { headers: authHeaders });
  if (listActive.ok()) {
    const activeTests = (await listActive.json()) as Array<{ id: string; template_id: string }>;
    const active = activeTests.find((entry) => entry.template_id === templateId);
    if (active) {
      await request.delete(`${API_BASE_URL}/active-tests/${active.id}`, { headers: authHeaders });
    }
  }

  await request.delete(`${API_BASE_URL}/templates/${templateId}`, { headers: authHeaders });
  await archiveInferenceServer(request, server.inference_server.server_id);
});
