import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';

import { archiveInferenceServer, findInferenceServerByName } from './helpers.js';

test('creates a new inference server from the dashboard', async ({ page, request }) => {
  const displayName = `E2E Server ${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const baseUrl = 'http://localhost:8080';

  await page.goto('/catalog?tab=servers');

  await page.locator('.catalog-section-title').filter({ hasText: 'Inference servers' }).getByRole('button', { name: '+ Add server' }).click();

  const createDrawer = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: 'Add inference server' }) });
  await expect(createDrawer).toBeVisible();
  const createForm = createDrawer.locator('form');

  // ── Left column: inference server fields ──
  await createForm.getByLabel('Display name').fill(displayName);
  await createForm.getByLabel('Base URL').fill(baseUrl);

  // Enable tool calls and streaming capabilities
  await createForm.getByLabel('Streaming').check();
  await createForm.getByLabel('Tool calls').check();

  // ── Right column: hosting server fields ──
  await createForm.getByLabel('GPU vendor').selectOption('nvidia');
  await createForm.getByLabel('GPU model').fill('RTX 4090');
  await createForm.getByLabel('VRAM (GB)').fill('24');

  await createForm.getByTestId('os-name-select').selectOption('linux');
  await createForm.getByLabel('OS version').fill('Ubuntu 22.04 LTS');
  await createForm.getByTestId('os-arch-select').selectOption('x86_64');

  // Test connection then save
  await createForm.getByRole('button', { name: 'Test connection' }).click();
  await expect(createForm.locator('.probe-panel')).toBeVisible({ timeout: 10000 });
  await createForm.getByRole('button', { name: /Save to Catalog|Save anyway/ }).click();

  await expect(page.locator('.catalog-server-card').filter({ hasText: displayName })).toBeVisible();

  // Verify API record has the submitted hardware and capabilities
  const created = await findInferenceServerByName(request, displayName);
  expect(created).not.toBeNull();
  if (created) {
    expect(created.runtime.hardware.gpu[0]?.vendor).toBe('nvidia');
    expect(created.runtime.hardware.gpu[0]?.model).toBe('RTX 4090');
    expect(created.runtime.hardware.gpu[0]?.vram_mb).toBe(24576);
    expect(created.runtime.platform.os.name).toBe('linux');
    expect(created.runtime.platform.os.version).toBe('Ubuntu 22.04 LTS');
    expect(created.runtime.platform.os.arch).toBe('x86_64');
    expect(created.capabilities.server.streaming).toBe(true);
    expect(created.capabilities.generation.tools).toBe(true);

    await archiveInferenceServer(request, created.inference_server.server_id);
  }
});
