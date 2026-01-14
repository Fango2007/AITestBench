import { expect, test } from '@playwright/test';

test('creates, updates, and deletes templates from the dashboard', async ({ page }) => {
  const templateId = `e2e-template-${Date.now()}`;
  const templateName = 'E2E Template';
  const updatedName = 'E2E Template Updated';
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

  await page.goto('/');
  await page.getByRole('button', { name: 'Templates' }).click();

  await page.getByLabel('Template ID').fill(templateId);
  await page.getByLabel('Name').fill(templateName);
  await page.getByLabel('Version').fill(version);
  await page.getByLabel('Content').fill(jsonContent);
  await page.getByRole('button', { name: 'Save' }).click();

  const listCard = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Templates' }) });
  await expect(listCard.getByText(templateName)).toBeVisible();

  await listCard.getByRole('button', { name: 'Edit' }).first().click();
  await page.getByLabel('Name').fill(updatedName);
  await page.getByLabel('Version').fill(updatedVersion);
  await page.getByLabel('Content').fill(updatedContent);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(listCard.getByText(updatedName)).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  await listCard.getByRole('button', { name: 'Delete' }).first().click();
  await expect(listCard.getByText(updatedName)).not.toBeVisible();
});
