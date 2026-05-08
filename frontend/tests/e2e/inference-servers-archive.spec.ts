import { expect, test } from '@playwright/test';

import { archiveInferenceServer, createInferenceServer } from './helpers.js';

test('archives an inference server', async ({ page, request }) => {
  const created = await createInferenceServer(request);

  await page.goto('/');

  const serverCard = page.locator('.catalog-server-card').filter({ hasText: created.inference_server.display_name });
  await expect(serverCard).toBeVisible();
  await serverCard.click();

  const [archiveResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST'
        && response.url().includes(`/inference-servers/${created.inference_server.server_id}/archive`)
    ),
    page.getByRole('button', { name: 'Archive', exact: true }).click()
  ]);
  expect(archiveResponse.ok()).toBeTruthy();

  await expect(page.getByRole('button', { name: 'Unarchive', exact: true })).toBeVisible();
});
