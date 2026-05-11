import { expect, test } from '@playwright/test';

test('loads comparison page', async ({ page }) => {
  await page.goto('/run?legacy=compare');

  await expect(page.locator('.merged-page-header').getByRole('heading', { name: 'Run', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pick model(s) to run' })).toBeVisible();
});
