import { expect, test } from '@playwright/test';

test('loads comparison page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Compare' }).click();

  await expect(page.getByRole('heading', { name: 'Compare Runs' })).toBeVisible();
  await expect(page.getByLabel('Filter')).toBeVisible();
});
