import { expect, test } from '@playwright/test';

import { archiveInferenceServer, createInferenceServer, findInferenceServerByName } from './helpers.js';

test('edits an inference server', async ({ page, request }) => {
  const created = await createInferenceServer(request);
  const updatedName = `${created.inference_server.display_name} Updated`;

  await page.goto('/');

  const serverCard = page.locator('.catalog-server-card').filter({ hasText: created.inference_server.display_name });
  await expect(serverCard).toBeVisible();
  await serverCard.click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();

  const editForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: new RegExp(`Edit · ${created.inference_server.display_name}`) }) });

  await editForm.getByLabel('Display name').fill(updatedName);
  await editForm.getByRole('button', { name: 'Save & re-probe' }).click();
  await editForm.getByRole('button', { name: /Save anyway|Save & open in Catalog/ }).click();

  await expect(page.locator('.catalog-server-card').filter({ hasText: updatedName })).toBeVisible();

  const updated = (await findInferenceServerByName(request, updatedName)) ?? created;
  await archiveInferenceServer(request, updated.inference_server.server_id);
});
