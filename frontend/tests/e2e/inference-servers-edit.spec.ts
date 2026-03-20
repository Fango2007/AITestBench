import { expect, test } from '@playwright/test';

import { archiveInferenceServer, createInferenceServer, findInferenceServerByName } from './helpers.js';

test('edits an inference server', async ({ page, request }) => {
  const created = await createInferenceServer(request);
  const updatedName = `${created.inference_server.display_name} Updated`;

  await page.goto('/');

  const serverTab = page.locator('.details-tabs button').filter({ hasText: created.inference_server.display_name });
  await expect(serverTab).toBeVisible();
  await serverTab.click();
  await page.getByRole('button', { name: 'Update', exact: true }).click();

  const editForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Edit inference server' }) });

  await editForm.getByLabel('Display name').fill(updatedName);
  await editForm.getByRole('button', { name: 'Save' }).click();

  const updatedTab = page.locator('.details-tabs button').filter({ hasText: updatedName });
  await expect(updatedTab).toBeVisible();
  const nameRow = page.locator('.detail-row').filter({
    has: page.getByText('Inference Server', { exact: true })
  });
  await expect(nameRow).toContainText(updatedName);

  const updated = (await findInferenceServerByName(request, updatedName)) ?? created;
  await archiveInferenceServer(request, updated.inference_server.server_id);
});
