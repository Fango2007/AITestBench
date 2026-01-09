import { expect, test } from '@playwright/test';

import { deleteTarget, findTargetByName } from './helpers';

test('creates a new target from the dashboard', async ({ page, request }) => {
  const targetName = `E2E Target ${Date.now()}`;
  const baseUrl = 'http://localhost:11434';

  await page.goto('/');

  const createForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Create target' }) });

  await createForm.getByLabel('Name').fill(targetName);
  await createForm.getByLabel('Base URL').fill(baseUrl);
  await createForm.getByRole('button', { name: 'Create' }).click();

  const activeCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Active targets' }) });

  await expect(activeCard.getByText(targetName)).toBeVisible();

  const created = await findTargetByName(request, targetName);
  if (created) {
    await deleteTarget(request, created.id);
  }
});
