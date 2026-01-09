import { expect, test } from '@playwright/test';

test('loads models page', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Models' }).click();

  await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible();
});
