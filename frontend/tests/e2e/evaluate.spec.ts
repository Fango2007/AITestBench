import { expect, test } from '@playwright/test';

test.describe('Evaluate page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/evaluate');
    await expect(page.getByRole('heading', { name: 'Evaluate' })).toBeVisible();
  });

  test('shows the evaluation form with all required inputs', async ({ page }) => {
    await expect(page.locator('.evaluation-form select').first()).toBeVisible();
    await expect(page.getByPlaceholder('Enter your prompt...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Inference' })).toBeVisible();
  });

  test('validation flow — Run button is disabled without server, model, and prompt', async ({ page }) => {
    const runButton = page.getByRole('button', { name: 'Run Inference' });
    await expect(runButton).toBeDisabled();
  });

  // T040 [US4] — Compare mode
  test('compare mode — activates with toggle and shows two forms', async ({ page }) => {
    await page.getByRole('button', { name: 'Compare Mode' }).click();
    await expect(page.locator('.shared-prompt-area')).toBeVisible();
    await expect(page.locator('.evaluation-form')).toHaveCount(2);
  });

  test('compare mode — can add up to 4 models', async ({ page }) => {
    await page.getByRole('button', { name: 'Compare Mode' }).click();
    await page.getByRole('button', { name: '+' }).click();
    await expect(page.locator('.evaluation-form')).toHaveCount(3);
    await page.getByRole('button', { name: '+' }).click();
    await expect(page.locator('.evaluation-form')).toHaveCount(4);
    await expect(page.getByRole('button', { name: '+' })).toBeDisabled();
  });

  test('compare mode — toggle off returns to single form', async ({ page }) => {
    await page.getByRole('button', { name: 'Compare Mode' }).click();
    await page.getByRole('button', { name: 'Single Mode' }).click();
    await expect(page.locator('.evaluation-form')).toHaveCount(1);
    await expect(page.locator('.shared-prompt-area')).not.toBeVisible();
  });
});

test('Evaluate page model menu uses discovered server models when model records are empty', async ({ page }) => {
  const serverPayload = [
    {
      inference_server: {
        server_id: 'srv-discovered-models',
        display_name: 'Discovered Models Server',
        active: true,
        archived: false,
        created_at: '2026-05-05T00:00:00.000Z',
        updated_at: '2026-05-05T00:00:00.000Z',
        archived_at: null
      },
      runtime: {
        retrieved_at: '2026-05-05T00:00:00.000Z',
        source: 'server',
        server_software: { name: 'Test Runtime', version: null, build: null },
        api: { schema_family: ['openai-compatible'], api_version: null },
        platform: {
          os: { name: 'unknown', version: null, arch: 'unknown' },
          container: { type: 'none', image: null }
        },
        hardware: {
          cpu: { model: null, cores: null },
          gpu: [],
          ram_mb: null
        }
      },
      endpoints: { base_url: 'http://localhost:11434', health_url: null, https: false },
      auth: { type: 'none', header_name: 'Authorization', token_env: null },
      capabilities: {
        server: { streaming: false, models_endpoint: true },
        generation: { text: true, json_schema_output: false, tools: false, embeddings: false },
        multimodal: {
          vision: { input_images: false, output_images: false },
          audio: { input_audio: false, output_audio: false }
        },
        reasoning: { exposed: false, token_budget_configurable: false },
        concurrency: { parallel_requests: false, parallel_tool_calls: false, max_concurrent_requests: null },
        enforcement: 'server'
      },
      discovery: {
        retrieved_at: '2026-05-05T00:00:00.000Z',
        ttl_seconds: 300,
        model_list: {
          raw: {},
          normalised: [
            {
              model_id: 'mistral:latest',
              display_name: 'Mistral Latest',
              context_window_tokens: null,
              quantisation: null
            }
          ]
        }
      },
      raw: {}
    }
  ];

  await page.route('**/inference-servers?*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(serverPayload)
    });
  });
  await page.route('**/inference-servers', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(serverPayload)
    });
  });
  await page.route('**/models', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.goto('/evaluate');
  const formSelects = page.locator('.evaluation-form select');
  const serverSelect = formSelects.first();
  const modelSelect = formSelects.nth(1);

  await serverSelect.selectOption('srv-discovered-models');
  await expect(modelSelect).toContainText('Mistral Latest');
  await modelSelect.selectOption('mistral:latest');
  await expect(modelSelect).toHaveValue('mistral:latest');
});
