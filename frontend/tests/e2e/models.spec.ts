import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';

import { createInferenceServer } from './helpers.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const API_BASE_URL = env.E2E_API_BASE_URL ?? 'http://localhost:8080';
const API_TOKEN = env.AITESTBENCH_API_TOKEN ?? env.VITE_AITESTBENCH_API_TOKEN;
const authHeaders: Record<string, string> = API_TOKEN ? { 'x-api-token': API_TOKEN } : {};

test.describe.configure({ mode: 'serial' });

async function seedModel(
  request: import('@playwright/test').APIRequestContext,
  serverId: string,
  opts: {
    model_id: string;
    display_name: string;
    quantized_provider?: string | null;
    format?: string | null;
    use_case?: {
      thinking?: boolean;
      coding?: boolean;
      instruct?: boolean;
      mixture_of_experts?: boolean;
    };
  }
) {
  const response = await request.post(`${API_BASE_URL}/models`, {
    data: {
      model: {
        server_id: serverId,
        model_id: opts.model_id,
        display_name: opts.display_name,
        active: true,
        archived: false
      },
      identity: {
        provider: 'unknown',
        family: null,
        version: null,
        revision: null,
        checksum: null,
        quantized_provider: opts.quantized_provider ?? null
      },
      architecture: {
        format: opts.format ?? null
      },
      capabilities: {
        use_case: opts.use_case ?? { thinking: false, coding: false, instruct: false, mixture_of_experts: false }
      }
    },
    headers: authHeaders
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`seedModel failed: ${response.status()} ${body}`);
  }
  return response.json();
}

async function cleanupServer(request: import('@playwright/test').APIRequestContext, serverId: string) {
  await request.post(`${API_BASE_URL}/inference-servers/${serverId}/archive`, { headers: authHeaders }).catch(() => undefined);
}

// ─── User Story 1: Quantized Provider filter + base_model_name display ────────

test.describe('US1 — Quantized Provider filter and clean model names', () => {
  test('selecting a Quantized Provider narrows the model list', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: '/lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit',
      display_name: 'Qwen3 Coder',
      quantized_provider: 'lmstudio-community'
    });
    await seedModel(request, serverId, {
      model_id: '/inferencerlabs/Devstral-Small-24B-Instruct',
      display_name: 'Devstral Small',
      quantized_provider: 'inferencerlabs'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    const quantizedSelect = page.locator('#quantized-provider-filter');
    await expect(quantizedSelect).toBeVisible();

    await quantizedSelect.selectOption('lmstudio-community');
    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.toLowerCase().includes('devstral'))).toBe(false);
    expect(optionTexts.length).toBeGreaterThan(0);

    await cleanupServer(request, serverId);
  });

  test('model selector shows base_model_name instead of raw model_id path', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: '/lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit',
      display_name: 'Qwen3 Coder',
      quantized_provider: 'lmstudio-community'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    const hasRawPath = optionTexts.some((t) => t.includes('/lmstudio-community/'));
    expect(hasRawPath).toBe(false);
    const hasCleanName = optionTexts.some((t) => t.includes('Qwen3-Coder-30B-A3B-Instruct'));
    expect(hasCleanName).toBe(true);

    await cleanupServer(request, serverId);
  });

  test('clearing Quantized Provider filter restores all models', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: '/lmstudio-community/ModelA',
      display_name: 'Model A',
      quantized_provider: 'lmstudio-community'
    });
    await seedModel(request, serverId, {
      model_id: '/inferencerlabs/ModelB',
      display_name: 'Model B',
      quantized_provider: 'inferencerlabs'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    const quantizedSelect = page.locator('#quantized-provider-filter');
    await quantizedSelect.selectOption('lmstudio-community');
    await quantizedSelect.selectOption('all');

    const modelSelect = page.locator('#model-filter');
    const optionCount = await modelSelect.locator('option').count();
    expect(optionCount).toBeGreaterThanOrEqual(2);

    await cleanupServer(request, serverId);
  });
});

// ─── User Story 2: Capability tags filter ─────────────────────────────────────

test.describe('US2 — Capability tags filter', () => {
  test('filtering by a single capability tag narrows the model list', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'thinking-model',
      display_name: 'Thinking Model',
      use_case: { thinking: true, coding: false, instruct: false, mixture_of_experts: false }
    });
    await seedModel(request, serverId, {
      model_id: 'plain-model',
      display_name: 'Plain Model',
      use_case: { thinking: false, coding: false, instruct: false, mixture_of_experts: false }
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="checkbox"][value="thinking"]').check();
    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.includes('plain-model'))).toBe(false);
    expect(optionTexts.some((t) => t.includes('thinking-model'))).toBe(true);

    await cleanupServer(request, serverId);
  });

  test('multi-selecting capability tags applies AND logic', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'thinking-coding',
      display_name: 'Thinking+Coding',
      use_case: { thinking: true, coding: true, instruct: false, mixture_of_experts: false }
    });
    await seedModel(request, serverId, {
      model_id: 'thinking-only',
      display_name: 'Thinking Only',
      use_case: { thinking: true, coding: false, instruct: false, mixture_of_experts: false }
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="checkbox"][value="thinking"]').check();
    await page.locator('input[type="checkbox"][value="coding"]').check();

    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.includes('thinking-only'))).toBe(false);
    expect(optionTexts.some((t) => t.includes('thinking-coding'))).toBe(true);

    await cleanupServer(request, serverId);
  });

  test('models without the selected capability tag are excluded', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'no-tags-model',
      display_name: 'No Tags Model'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="checkbox"][value="thinking"]').check();
    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.includes('no-tags-model'))).toBe(false);

    await cleanupServer(request, serverId);
  });
});

// ─── User Story 4: Update modal and registration form with new fields ─────────

test.describe('US4 — Update modal with enriched metadata fields', () => {
  test('Update modal saves Quantized Provider and it appears in filter', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'update-test-model',
      display_name: 'Update Test Model'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('#server-filter').selectOption(serverId);
    await page.locator('#model-filter').selectOption('update-test-model');
    await page.getByRole('button', { name: 'Update' }).click();

    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible();

    await modal.locator('#update-quantized-provider').fill('inferencerlabs');
    await modal.getByRole('button', { name: 'Update model' }).click();
    await expect(modal).not.toBeVisible();

    const quantizedSelect = page.locator('#quantized-provider-filter');
    const options = await quantizedSelect.locator('option').allTextContents();
    expect(options.some((t) => t.includes('inferencerlabs'))).toBe(true);

    await cleanupServer(request, serverId);
  });

  test('Update modal saves capability tags and they appear in capability filter', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'cap-test-model',
      display_name: 'Cap Test Model'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('#server-filter').selectOption(serverId);
    await page.locator('#model-filter').selectOption('cap-test-model');
    await page.getByRole('button', { name: 'Update' }).click();

    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible();
    await modal.locator('input[type="checkbox"][name="update-cap-coding"]').check();
    await modal.getByRole('button', { name: 'Update model' }).click();
    await expect(modal).not.toBeVisible();

    await page.locator('input[type="checkbox"][value="coding"]').check();
    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.includes('cap-test-model'))).toBe(true);

    await cleanupServer(request, serverId);
  });

  test('no full page reload occurs after saving the update modal', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'reload-test',
      display_name: 'Reload Test'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('#server-filter').selectOption(serverId);
    await page.locator('#quantized-provider-filter');

    await page.locator('#model-filter').selectOption('reload-test');
    await page.getByRole('button', { name: 'Update' }).click();

    const modal = page.locator('.modal-overlay');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Update model' }).click();
    await expect(modal).not.toBeVisible();

    await expect(page.locator('#server-filter')).toHaveValue(serverId);

    await cleanupServer(request, serverId);
  });
});

// ─── User Story 3: Format filter ──────────────────────────────────────────────

test.describe('US3 — Format filter', () => {
  test('discovered-only MLX model IDs populate inferred filters and update defaults', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;
    const modelId = '/inferencerlabs/Devstral-Small-2-24B-Instruct-2512-MLX-6.5bit';

    const patchResponse = await request.patch(`${API_BASE_URL}/inference-servers/${serverId}`, {
      data: {
        discovery: {
          model_list: {
            raw: {},
            normalised: [
              {
                model_id: modelId,
                display_name: modelId,
                context_window_tokens: 32768,
                quantisation: null,
              },
              {
                model_id: 'Devstral-Small-2-24B-Instruct',
                display_name: 'Devstral-Small-2-24B-Instruct',
                context_window_tokens: 32768,
                quantisation: null,
              },
            ],
          },
        },
      },
      headers: authHeaders,
    });
    expect(patchResponse.ok()).toBe(true);

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');
    await page.locator('#server-filter').selectOption(serverId);

    await expect(page.locator('#provider-filter')).toContainText('Mistral');
    await expect(page.locator('#quantized-provider-filter')).toContainText('inferencerlabs');
    await expect(page.locator('#format-filter')).toContainText('MLX');
    await expect(page.locator('#quant-bits-filter')).toContainText('6.5-bit');

    await page.locator('#provider-filter').selectOption('mistral');
    await page.locator('#quantized-provider-filter').selectOption('inferencerlabs');
    await page.locator('#format-filter').selectOption('MLX');
    await page.locator('#quant-bits-filter').selectOption('6.5');

    const optionTexts = await page.locator('#model-filter option').allTextContents();
    expect(optionTexts.filter((text) => text.includes('Devstral-Small-2-24B-Instruct'))).toHaveLength(1);
    expect(optionTexts.some((text) => text.includes('/inferencerlabs/'))).toBe(false);

    await page.getByRole('button', { name: 'Update' }).click();
    const modal = page.locator('.modal-overlay');
    await expect(modal.locator('#update-provider')).toHaveValue('mistral');
    await expect(modal.locator('#update-quantized-provider')).toHaveValue('inferencerlabs');
    await expect(modal.locator('#update-format')).toHaveValue('MLX');
    await expect(modal.locator('#update-quant-method')).toHaveValue('mlx');
    await expect(modal.locator('#update-quant-bits')).toHaveValue('6.5');
    await expect(modal.locator('input[type="checkbox"][name="update-cap-coding"]')).toBeChecked();
    await expect(modal.locator('input[type="checkbox"][name="update-cap-instruct"]')).toBeChecked();

    await cleanupServer(request, serverId);
  });

  test('filtering by Format = MLX shows only MLX models', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'mlx-model',
      display_name: 'MLX Model',
      format: 'MLX'
    });
    await seedModel(request, serverId, {
      model_id: 'gguf-model',
      display_name: 'GGUF Model',
      format: 'GGUF'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('#format-filter').selectOption('MLX');
    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.includes('gguf-model'))).toBe(false);
    expect(optionTexts.some((t) => t.includes('mlx-model'))).toBe(true);

    await cleanupServer(request, serverId);
  });

  test('models with no format set are excluded when a format filter is active', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'no-format-model',
      display_name: 'No Format Model'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('#format-filter').selectOption('MLX');
    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.includes('no-format-model'))).toBe(false);

    await cleanupServer(request, serverId);
  });

  test('selecting All formats restores the full model list', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'mlx-restore',
      display_name: 'MLX Restore',
      format: 'MLX'
    });
    await seedModel(request, serverId, {
      model_id: 'gguf-restore',
      display_name: 'GGUF Restore',
      format: 'GGUF'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('#format-filter').selectOption('MLX');
    await page.locator('#format-filter').selectOption('all');

    const modelSelect = page.locator('#model-filter');
    const optionCount = await modelSelect.locator('option').count();
    expect(optionCount).toBeGreaterThanOrEqual(2);

    await cleanupServer(request, serverId);
  });

  test('combined Provider + Format filter shows AND results', async ({ page, request }) => {
    const server = await createInferenceServer(request);
    const serverId = server.inference_server.server_id;

    await seedModel(request, serverId, {
      model_id: 'mlx-lmstudio',
      display_name: 'MLX LMStudio',
      format: 'MLX',
      quantized_provider: 'lmstudio-community'
    });
    await seedModel(request, serverId, {
      model_id: 'gguf-lmstudio',
      display_name: 'GGUF LMStudio',
      format: 'GGUF',
      quantized_provider: 'lmstudio-community'
    });

    await page.goto('/catalog?tab=models');
    await page.waitForLoadState('networkidle');

    await page.locator('#quantized-provider-filter').selectOption('lmstudio-community');
    await page.locator('#format-filter').selectOption('MLX');

    const modelSelect = page.locator('#model-filter');
    const optionTexts = await modelSelect.locator('option').allTextContents();
    expect(optionTexts.some((t) => t.includes('gguf-lmstudio'))).toBe(false);
    expect(optionTexts.some((t) => t.includes('mlx-lmstudio'))).toBe(true);

    await cleanupServer(request, serverId);
  });
});
