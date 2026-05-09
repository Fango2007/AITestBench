import { expect, test } from '@playwright/test';

import { cleanupTemplateIds } from './helpers.js';

test('creates, updates, and deletes templates from the dashboard', async ({ page }) => {
  const suffix = Date.now();
  const templateId = `e2e-template-${suffix}`;
  const templateName = `E2E Template ${suffix}`;
  const updatedName = `E2E Template Updated ${suffix}`;
  const version = '1.0.0';
  const updatedVersion = '1.0.1';
  const jsonContent = JSON.stringify(
    {
      id: templateId,
      version,
      name: templateName,
      description: 'E2E template',
      protocols: [],
      request: { method: 'POST', path: '/v1/chat/completions', body_template: {} },
      assertions: [],
      metrics: {}
    },
    null,
    2
  );

  const updatedContent = JSON.stringify(
    {
      id: templateId,
      version: updatedVersion,
      name: updatedName,
      description: 'E2E template updated',
      protocols: [],
      request: { method: 'POST', path: '/v1/chat/completions', body_template: {} },
      assertions: [],
      metrics: {}
    },
    null,
    2
  );

  try {
    await page.goto('/templates');
    await page.getByRole('button', { name: 'New JSON' }).first().click();
    const createForm = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Create template' }) });
    await expect(createForm).toBeVisible();

    await createForm.getByLabel('Template ID').fill(templateId);
    await createForm.getByLabel('Name', { exact: true }).fill(templateName);
    await createForm.getByLabel('Version', { exact: true }).fill(version);
    await createForm.getByRole('textbox', { name: 'Content', exact: true }).fill(jsonContent);
    await createForm.getByRole('button', { name: 'Save' }).click();

    const createdRow = page.locator('.template-row').filter({ hasText: templateName });
    await expect(createdRow).toBeVisible();
    await expect(createdRow).toContainText(templateName);

    await createdRow.click();
    await expect(page.locator('.template-preview-panel')).toContainText(templateId);
    await page.locator('.template-preview-panel').getByRole('button', { name: 'Edit' }).click();
    const editForm = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Edit template' }) });
    await expect(editForm).toBeVisible();
    await editForm.getByLabel('Name', { exact: true }).fill(updatedName);
    await editForm.getByLabel('Version', { exact: true }).fill(updatedVersion);
    await editForm.getByRole('textbox', { name: 'Content', exact: true }).fill(updatedContent);
    await editForm.getByRole('button', { name: 'Save' }).click();

    const updatedRow = page.locator('.template-row').filter({ hasText: updatedName });
    await expect(updatedRow).toBeVisible();
    await expect(updatedRow).toContainText(updatedName);
    await expect(updatedRow).toContainText(updatedVersion);

    page.on('dialog', (dialog) => dialog.accept());
    await updatedRow.click();
    await page.locator('.template-preview-panel').getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.template-row').filter({ hasText: updatedName })).toHaveCount(0);
  } finally {
    await cleanupTemplateIds(page.request, [templateId]);
  }
});
