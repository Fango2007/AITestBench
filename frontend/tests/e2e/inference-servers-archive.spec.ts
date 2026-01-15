import { expect, test } from '@playwright/test';

import { archiveInferenceServer, createInferenceServer } from './helpers.js';

test('archives an inference server', async ({ page, request }) => {
  const created = await createInferenceServer(request);

  await page.goto('/');

  const activeCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Active' }) });
  const archivedCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Archived' }) });

  const listItem = activeCard
    .getByRole('listitem')
    .filter({ hasText: created.inference_server.display_name });
  await expect(listItem).toBeVisible();

  const [archiveResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.url().includes(`/inference-servers/${created.inference_server.server_id}/archive`)
    ),
    listItem.getByRole('button', { name: 'Archive' }).click()
  ]);
  expect(archiveResponse.ok()).toBeTruthy();

  await expect(activeCard.getByText(created.inference_server.display_name)).toHaveCount(0);
  await expect(archivedCard.getByText(created.inference_server.display_name)).toBeVisible();

  await archiveInferenceServer(request, created.inference_server.server_id);
});
