import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';

import { archiveInferenceServer, createInferenceServer } from './helpers.js';

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
    throw new Error(`seedModel failed: ${response.status()} ${await response.text()}`);
  }
}

test('models tab requires a selected server before showing model cards', async ({ page, request }) => {
  const server = await createInferenceServer(request);
  await seedModel(request, server.inference_server.server_id, {
    model_id: '/lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit',
    display_name: 'Qwen3 Coder',
    format: 'MLX'
  });

  await page.goto('/catalog?tab=models');
  await expect(page.getByRole('heading', { name: 'Select a server to see its models' })).toBeVisible();

  await page.locator('.server-filter-row').filter({ hasText: server.inference_server.display_name }).click();
  await expect(page.locator('.catalog-model-card').filter({ hasText: 'Qwen3-Coder-30B-A3B-Instruct' })).toBeVisible();

  await archiveInferenceServer(request, server.inference_server.server_id);
});

test('model filter rail narrows visible model cards', async ({ page, request }) => {
  const server = await createInferenceServer(request);
  const serverId = server.inference_server.server_id;
  await seedModel(request, serverId, {
    model_id: '/lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit',
    display_name: 'Qwen3 Coder',
    format: 'MLX'
  });
  await seedModel(request, serverId, {
    model_id: '/inferencerlabs/Devstral-Small-24B-Instruct-GGUF-Q4_K_M',
    display_name: 'Devstral Small',
    format: 'GGUF'
  });

  await page.goto(`/catalog?tab=models&servers=${encodeURIComponent(serverId)}`);
  await page.waitForLoadState('networkidle');

  await page.getByLabel('MLX').check();
  await expect(page.locator('.catalog-model-card').filter({ hasText: 'Qwen3-Coder' })).toBeVisible();
  await expect(page.locator('.catalog-model-card').filter({ hasText: 'Devstral' })).toHaveCount(0);

  await expect(page).toHaveURL(/format=MLX/);
  await archiveInferenceServer(request, serverId);
});

test('Inspect opens the catalog model inspector for the selected server/model', async ({ page, request }) => {
  const server = await createInferenceServer(request);
  const serverId = server.inference_server.server_id;
  const modelId = 'meta-llama/Llama-3.1-8B';
  await seedModel(request, serverId, {
    model_id: modelId,
    display_name: 'Llama 3.1 8B'
  });

  await page.goto(`/catalog?tab=models&servers=${encodeURIComponent(serverId)}`);
  await page.waitForLoadState('networkidle');
  await page.locator('.catalog-model-card').filter({ hasText: 'Llama-3.1-8B' }).getByRole('button', { name: 'Inspect' }).click();

  await expect(page).toHaveURL(new RegExp(`serverId=${serverId}`));
  await expect(page).toHaveURL(/modelId=meta-llama/);
  await expect(page.getByRole('button', { name: '← Back to Catalog' })).toBeVisible();

  await archiveInferenceServer(request, serverId);
});
