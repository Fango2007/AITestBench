import { expect, test } from '@playwright/test';

test.describe('Evaluate page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Evaluate' }).click();
    await expect(page.getByRole('heading', { name: 'Evaluate' })).toBeVisible();
  });

  test('shows the evaluation form with all required inputs', async ({ page }) => {
    await expect(page.getByText('Inference server')).toBeVisible();
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
