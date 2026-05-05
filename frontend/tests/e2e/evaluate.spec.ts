import { expect, test } from '@playwright/test';

test.describe('Evaluate page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Evaluate' }).click();
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
  await page.route('**/inference-servers**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
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
          runtime: {},
          endpoints: { base_url: 'http://localhost:11434', health_url: null, https: false },
          auth: {},
          capabilities: {},
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
      ])
    });
  });
  await page.route('**/models', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Evaluate' }).click();
  await page.getByLabel('Inference server').selectOption('srv-discovered-models');

  await expect(page.getByLabel('Model')).toContainText('Mistral Latest');
  await page.getByLabel('Model').selectOption('mistral:latest');
  await expect(page.getByLabel('Model')).toHaveValue('mistral:latest');
});
