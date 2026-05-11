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
const API_TOKEN = env.INFERHARNESS_API_TOKEN ?? env.VITE_INFERHARNESS_API_TOKEN;
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

function buildPythonTemplateContent(id: string, name: string, version = '1.0.0') {
  return JSON.stringify(
    {
      kind: 'python_test',
      schema_version: 'v1',
      id,
      name,
      version,
      lifecycle: { status: 'active' },
      python: { module: 'tests.python.sample_test', entrypoint: 'entrypoint' },
      contracts: { requires: [], provides: [] },
      defaults: {},
      outputs: {
        result_schema: 'scenario_result.v1',
        normalised_response: 'response_normalisation.v1'
      }
    },
    null,
    2
  );
}

test('supports JSON and Python template types', async ({ page, request }) => {
  const serverDisplayName = `E2E Template Type Server ${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const server = await createInferenceServer(request, {
    display_name: serverDisplayName
  });
  const suffix = Date.now();
  const jsonTemplateId = `e2e-json-${suffix}`;
  const pythonTemplateId = `e2e-python-${suffix}`;
  const jsonTemplateName = `JSON Template ${suffix}`;
  const pythonTemplateName = `Python Template ${suffix}`;
  try {
    const jsonTemplateResponse = await request.post(`${API_BASE_URL}/templates`, {
      headers: authHeaders,
      data: {
        id: jsonTemplateId,
        name: jsonTemplateName,
        type: 'json',
        version: '1.0.0',
        content: buildJsonTemplateContent(jsonTemplateId, jsonTemplateName)
      }
    });
    expect(jsonTemplateResponse.ok()).toBeTruthy();

    const pythonTemplateResponse = await request.post(`${API_BASE_URL}/templates`, {
      headers: authHeaders,
      data: {
        id: pythonTemplateId,
        name: pythonTemplateName,
        type: 'python',
        version: '1.0.0',
        content: buildPythonTemplateContent(pythonTemplateId, pythonTemplateName)
      }
    });
    expect(pythonTemplateResponse.ok()).toBeTruthy();

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
    await expect(page.locator('.merged-page-header').getByRole('heading', { name: 'Run', exact: true })).toBeVisible();

    const inferenceServerSelect = page.getByRole('combobox', { name: 'Inference server', exact: true });
    await expect(inferenceServerSelect).toBeVisible();
    const availableServerLabels = await inferenceServerSelect.evaluate((element) => {
      if (!(element instanceof HTMLSelectElement)) {
        return [];
      }
      return Array.from(element.options)
        .map((option) => option.text.trim())
        .filter((label) => label.length > 0 && label !== 'Select an inference server');
    });
    expect(availableServerLabels.length).toBeGreaterThan(0);
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
    const jsonTemplateLabel = availableTemplateLabels.find((label) => label.includes(jsonTemplateName));
    const pythonTemplateLabel = availableTemplateLabels.find((label) => label.includes(pythonTemplateName));
    expect(jsonTemplateLabel).toBeTruthy();
    expect(pythonTemplateLabel).toBeTruthy();
    await templatesSelect.selectOption([
      { label: jsonTemplateLabel! },
      { label: pythonTemplateLabel! }
    ]);

    await expect(page.getByTitle('gpt-4o-mini')).toBeVisible();
    await expect(page.getByRole('button', { name: /Run · 1 models × 2 templates/ })).toBeEnabled();
  } finally {
    await cleanupTemplateIds(request, [jsonTemplateId, pythonTemplateId]);
    await archiveInferenceServer(request, server.inference_server.server_id);
  }
});
