import { expect, test } from '@playwright/test';

import { createTarget, deleteTarget } from './helpers';

test('deletes a target', async ({ page, request }) => {
  const created = await createTarget(request);

  await page.goto('/');

  const listItem = page.getByRole('listitem').filter({ hasText: created.name });
  await expect(listItem).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const [deleteResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE'
        && response.url().includes(`/targets/${created.id}`)
    ),
    listItem.getByRole('button', { name: 'Delete' }).click()
  ]);
  expect(deleteResponse.ok()).toBeTruthy();
  await expect(listItem).toHaveCount(0, { timeout: 10_000 });

  try {
    await deleteTarget(request, created.id);
  } catch {
    // already deleted in UI
  }
});
