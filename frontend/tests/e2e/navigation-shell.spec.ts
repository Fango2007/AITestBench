import { expect, test } from '@playwright/test';

test('sidebar exposes five top-level destinations and follows active routes', async ({ page }) => {
  await page.goto('/catalog?tab=servers');

  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav.getByRole('link')).toHaveCount(5);
  await expect(nav.locator('.sidebar-item__main span:first-child')).toHaveText([
    'Catalog',
    'Templates',
    'Run',
    'Results',
    'Evaluate'
  ]);

  for (const [href, label] of [
    ['/catalog?tab=servers', 'Catalog'],
    ['/templates', 'Templates'],
    ['/run', 'Run'],
    ['/results?tab=dashboard', 'Results'],
    ['/evaluate', 'Evaluate']
  ] as const) {
    await page.goto(href);
    await expect(nav.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveClass(/is-active/);
  }
});

test('merged page sub-tabs preserve route state', async ({ page }) => {
  await page.goto('/catalog?tab=servers');
  await page.getByRole('tab', { name: /Models/ }).click();
  await expect(page).toHaveURL(/\/catalog\?tab=models/);

  await page.goto('/results?tab=dashboard');
  await page.getByRole('tab', { name: /Leaderboard/ }).click();
  await expect(page).toHaveURL(/\/results\?tab=leaderboard/);
  await page.getByRole('tab', { name: /History/ }).click();
  await expect(page).toHaveURL(/\/results\?tab=history/);
});

test('legacy routes redirect to the new IA contract', async ({ page }) => {
  for (const [legacyPath, expected] of [
    ['/servers', /\/catalog\?tab=servers/],
    ['/models', /\/catalog\?tab=models/],
    ['/run-single', /\/run$/],
    ['/compare', /\/run$/],
    ['/dashboard', /\/results\?tab=dashboard/],
    ['/leaderboard', /\/results\?tab=leaderboard/]
  ] as const) {
    await page.goto(legacyPath);
    await expect(page).toHaveURL(expected);
  }
});

test('settings opens from the sidebar footer', async ({ page }) => {
  await page.goto('/catalog?tab=servers');
  await page.getByRole('button', { name: /Settings/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
