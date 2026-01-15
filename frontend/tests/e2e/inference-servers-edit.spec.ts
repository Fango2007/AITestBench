import { expect, test } from '@playwright/test';

import { archiveInferenceServer, createInferenceServer, findInferenceServerByName } from './helpers.js';

test('edits an inference server', async ({ page, request }) => {
  const created = await createInferenceServer(request);
  const updatedName = `${created.inference_server.display_name} Updated`;

  await page.goto('/');

  const listItem = page
    .getByRole('listitem')
    .filter({ hasText: created.inference_server.display_name });
  await expect(listItem).toBeVisible();
  await listItem.getByRole('button', { name: 'Edit' }).click();

  const editForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Edit inference server' }) });

  await editForm.getByLabel('Display name').fill(updatedName);
  await editForm.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(updatedName)).toBeVisible();

  const updated = (await findInferenceServerByName(request, updatedName)) ?? created;
  await archiveInferenceServer(request, updated.inference_server.server_id);
});
