import { expect, test } from '@playwright/test';

import { deleteTemplate, findTemplateByName } from './helpers';

test('creates a test template from the dashboard', async ({ page, request }) => {
  const templateName = `E2E Template ${Date.now()}`;
  const templateContent = '{"message":"Hello"}';

  await page.goto('/');
  await page.getByRole('button', { name: 'Test Templates' }).click();

  const createForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Create template' }) });

  await createForm.getByLabel('Name').fill(templateName);
  await createForm.getByLabel('Format').selectOption('json');
  await createForm.getByLabel('Content').fill(templateContent);
  await createForm.getByRole('button', { name: 'Create' }).click();

  const activeCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Active templates' }) });

  const row = activeCard.locator('li').filter({ hasText: templateName });
  await expect(row.getByText(templateName)).toBeVisible();
  await expect(row.getByText('v1')).toBeVisible();

  const created = await findTemplateByName(request, templateName);
  if (created) {
    await deleteTemplate(request, created.id);
  }
});
