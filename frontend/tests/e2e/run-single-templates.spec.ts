import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';

import {
  archiveInferenceServer,
  cleanupTemplateIds,
  createInferenceServer,
  findInferenceServerByName
} from './helpers.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const API_BASE_URL = env.E2E_API_BASE_URL ?? 'http://localhost:8080';
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
  const serverDisplayName = `E2E Template Server ${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const server = await createInferenceServer(request, {
    display_name: serverDisplayName
  });
  const suffix = Date.now();
  const templateId = `e2e-template-${suffix}`;
  const templateName = `E2E Template Run ${suffix}`;

  try {
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

    await expect
      .poll(async () => {
        const listed = await findInferenceServerByName(request, serverDisplayName);
        return listed?.inference_server.display_name ?? null;
      })
      .toBe(serverDisplayName);

    const serversResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().includes('/inference-servers') &&
        response.ok()
    );
    await page.goto('/run');
    await serversResponse;

    const inferenceServerSelect = page.getByRole('combobox', { name: 'Inference server', exact: true });
    await expect(inferenceServerSelect).toBeVisible();
    const getServerLabels = () => inferenceServerSelect.evaluate((element) => {
      if (!(element instanceof HTMLSelectElement)) {
        return [];
      }
      return Array.from(element.options)
        .map((option) => option.text.trim())
        .filter((label) => label.length > 0 && label !== 'Select an inference server');
    });
    await expect.poll(async () => (await getServerLabels()).length).toBeGreaterThan(0);
    const availableServerLabels = await getServerLabels();
    if (availableServerLabels.includes(serverDisplayName)) {
      await inferenceServerSelect.selectOption({ label: serverDisplayName });
    } else {
      const fallbackLabel = availableServerLabels[0];
      if (!fallbackLabel) {
        throw new Error('No inference server options available in Run page.');
      }
      await inferenceServerSelect.selectOption({ label: fallbackLabel });
    }
    await page.getByRole('textbox', { name: 'Model', exact: true }).fill('gpt-4o-mini');
    await page.getByRole('button', { name: 'Add model', exact: true }).click();
    const templatesSelect = page.getByRole('listbox', { name: 'Templates', exact: true });
    const availableTemplateLabels = await templatesSelect.evaluate((element) => {
      if (!(element instanceof HTMLSelectElement)) {
        return [];
      }
      return Array.from(element.options).map((option) => option.text.trim());
    });
    const templateOptionLabel = availableTemplateLabels.find((label) => label.includes(templateName));
    expect(templateOptionLabel).toBeTruthy();
    await templatesSelect.selectOption({ label: templateOptionLabel! });

    await expect(page.getByTitle('gpt-4o-mini')).toBeVisible();
    await expect(page.getByRole('button', { name: /Run · 1 models × 1 templates/ })).toBeEnabled();
  } finally {
    await cleanupTemplateIds(request, [templateId]);
    await archiveInferenceServer(request, server.inference_server.server_id);
  }
});
