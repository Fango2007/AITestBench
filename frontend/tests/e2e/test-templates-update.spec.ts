import { expect, test } from '@playwright/test';

import { deleteTemplate, findTemplateByName } from './helpers';

test('updates a test template and shows a new version', async ({ page, request }) => {
  const templateName = `E2E Versioned Template ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Test Templates' }).click();

  const createForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Create template' }) });

  await createForm.getByLabel('Name').fill(templateName);
  await createForm.getByLabel('Format').selectOption('json');
  await createForm.getByLabel('Content').fill('{"message":"v1"}');
  await createForm.getByRole('button', { name: 'Create' }).click();

  const activeCard = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Active templates' }) });
  const row = activeCard.locator('li').filter({ hasText: templateName });

  await row.getByRole('button', { name: 'View' }).click();

  const updateForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Update template' }) });

  await updateForm.getByLabel('Content').fill('{"message":"v2"}');
  await updateForm.getByRole('button', { name: 'Save new version' }).click();

  await expect(row.getByText('v2')).toBeVisible();

  const created = await findTemplateByName(request, templateName);
  if (created) {
    await deleteTemplate(request, created.id);
  }
});
