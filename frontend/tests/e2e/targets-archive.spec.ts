import { expect, test } from '@playwright/test';

import { createTarget, deleteTarget } from './helpers.js';

test('archives a target', async ({ page, request }) => {
  const created = await createTarget(request);

  await page.goto('/');

  const activeCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Active targets' }) });
  const archivedCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Archived targets' }) });

  const listItem = activeCard.getByRole('listitem').filter({ hasText: created.name });
  await expect(listItem).toBeVisible();

  const [archiveResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.url().includes(`/targets/${created.id}/archive`)
    ),
    listItem.getByRole('button', { name: 'Archive' }).click()
  ]);
  expect(archiveResponse.ok()).toBeTruthy();

  await expect(activeCard.getByText(created.name)).toHaveCount(0);
  await expect(archivedCard.getByText(created.name)).toBeVisible();

  await deleteTarget(request, created.id);
});
