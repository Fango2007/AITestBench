import { expect, test } from '@playwright/test';

import { createTarget, deleteTarget } from './helpers';

test('inspects a target', async ({ page, request }) => {
  const created = await createTarget(request);

  await page.goto('/');

  const listItem = page.getByRole('listitem').filter({ hasText: created.name });
  await expect(listItem).toBeVisible();
  await listItem.getByRole('button', { name: 'Inspect' }).click();

  const inspector = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Target inspector' }) });

  await expect(inspector.getByText(created.name)).toBeVisible();
  await expect(inspector.getByText(created.base_url)).toBeVisible();

  await deleteTarget(request, created.id);
});
