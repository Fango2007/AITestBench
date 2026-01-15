import { expect, test } from '@playwright/test';

import { archiveInferenceServer, createInferenceServer } from './helpers.js';

test('inspects an inference server', async ({ page, request }) => {
  const created = await createInferenceServer(request);

  await page.goto('/');

  const listItem = page
    .getByRole('listitem')
    .filter({ hasText: created.inference_server.display_name });
  await expect(listItem).toBeVisible();
  await listItem.getByRole('button', { name: 'Inspect' }).click();

  const inspector = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Server details' }) });

  await expect(inspector.getByText(created.inference_server.display_name)).toBeVisible();
  await expect(inspector.getByText(created.endpoints.base_url)).toBeVisible();

  await archiveInferenceServer(request, created.inference_server.server_id);
});
