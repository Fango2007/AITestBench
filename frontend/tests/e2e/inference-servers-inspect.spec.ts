import { expect, test } from '@playwright/test';

import { archiveInferenceServer, createInferenceServer } from './helpers.js';

test('inspects an inference server', async ({ page, request }) => {
  const created = await createInferenceServer(request);

  await page.goto('/');

  const serverTab = page.locator('.details-tabs button').filter({ hasText: created.inference_server.display_name });
  await expect(serverTab).toBeVisible();
  await serverTab.click();

  const inferenceServerRow = page.locator('.detail-row').filter({
    has: page.getByText('Inference Server', { exact: true })
  });
  const baseUrlRow = page.locator('.detail-row').filter({
    has: page.getByText('Base URL', { exact: true })
  });

  await expect(inferenceServerRow.getByText(created.inference_server.display_name, { exact: true })).toBeVisible();
  await expect(baseUrlRow.getByText(created.endpoints.base_url, { exact: true })).toBeVisible();

  await archiveInferenceServer(request, created.inference_server.server_id);
});
