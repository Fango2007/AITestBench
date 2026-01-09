import { expect, test } from '@playwright/test';

import { createTarget, deleteTarget, findTargetByName } from './helpers';

test('edits a target', async ({ page, request }) => {
  const created = await createTarget(request);
  const updatedName = `${created.name} Updated`;

  await page.goto('/');

  const listItem = page.getByRole('listitem').filter({ hasText: created.name });
  await expect(listItem).toBeVisible();
  await listItem.getByRole('button', { name: 'Edit' }).click();

  const editForm = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Edit target' }) });

  await editForm.getByLabel('Name').fill(updatedName);
  await editForm.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(updatedName)).toBeVisible();

  const updated = (await findTargetByName(request, updatedName)) ?? created;
  await deleteTarget(request, updated.id);
});
