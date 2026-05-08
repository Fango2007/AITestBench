import { expect, test } from '@playwright/test';

import { archiveInferenceServer, findInferenceServerByName } from './helpers.js';

test('creates a new inference server from the dashboard', async ({ page, request }) => {
  const displayName = `E2E Server ${Date.now()}`;
  const baseUrl = 'http://localhost:8080';

  await page.goto('/');

  await page.getByRole('button', { name: '+ Add server' }).click();

  const createForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Add inference server' }) });

  await createForm.getByLabel('Display name').fill(displayName);
  await createForm.getByLabel('Base URL').fill(baseUrl);
  await createForm.getByRole('button', { name: 'Create & test connection' }).click();

  await expect(page.locator('.catalog-server-card').filter({ hasText: displayName })).toBeVisible();

  const created = await findInferenceServerByName(request, displayName);
  if (created) {
    await archiveInferenceServer(request, created.inference_server.server_id);
  }
});
