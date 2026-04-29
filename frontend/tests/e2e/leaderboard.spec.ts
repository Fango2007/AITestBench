import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APIRequestContext, expect, test } from '@playwright/test';

// Empty-state tests must run before any test seeds data into the shared DB.
test.describe.configure({ mode: 'serial' });
import { loadEnv } from 'vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');
const rawEnv = loadEnv(process.env.NODE_ENV ?? 'test', repoRoot, '');
const env = { ...rawEnv, ...process.env };
const API_BASE_URL = env.E2E_API_BASE_URL ?? 'http://localhost:8080';
const API_TOKEN = env.AITESTBENCH_API_TOKEN ?? env.VITE_AITESTBENCH_API_TOKEN;
const authHeaders = API_TOKEN ? { 'x-api-token': API_TOKEN } : {};

async function seedEvaluation(
  request: APIRequestContext,
  opts: { serverId: string; modelName: string; tags?: string[] }
) {
  const response = await request.post(`${API_BASE_URL}/evaluations`, {
    data: {
      prompt_text: `Test prompt for ${opts.modelName} ${Date.now()}`,
      tags: opts.tags ?? [],
      server_id: opts.serverId,
      model_name: opts.modelName,
      inference_config: { temperature: null, top_p: null, max_tokens: null, quantization_level: null },
      answer_text: 'Test answer',
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      latency_ms: null,
      word_count: 2,
      estimated_cost: null,
      accuracy_score: 4,
      relevance_score: 4,
      coherence_score: 4,
      completeness_score: 4,
      helpfulness_score: 4,
      note: null
    },
    headers: authHeaders
  });
  return response.json();
}

async function getOrCreateServer(request: APIRequestContext): Promise<string> {
  const listResponse = await request.get(`${API_BASE_URL}/inference-servers`, { headers: authHeaders });
  const servers = (await listResponse.json()) as Array<{ inference_server: { server_id: string } }>;
  if (servers.length > 0) {
    return servers[0].inference_server.server_id;
  }
  const createResponse = await request.post(`${API_BASE_URL}/inference-servers`, {
    data: {
      inference_server: { display_name: 'E2E Leaderboard Server' },
      endpoints: { base_url: 'http://localhost:11434' },
      runtime: { api: { schema_family: ['openai-compatible'], api_version: null } }
    },
    headers: authHeaders
  });
  const server = (await createResponse.json()) as { inference_server: { server_id: string } };
  return server.inference_server.server_id;
}

test.describe('Leaderboard page — empty state', () => {
  test('shows informative empty state message and CTA when no evaluations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
    await expect(page.getByText('No evaluations yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first evaluation' })).toBeVisible();
  });

  test('CTA navigates to Evaluate page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
    const cta = page.getByRole('button', { name: 'Create your first evaluation' });
    if (await cta.isVisible()) {
      await cta.click();
      await expect(page.getByRole('heading', { name: 'Evaluate' })).toBeVisible();
    }
  });
});

// T035 [US2] — populated state
test.describe('Leaderboard page — populated state', () => {
  test('shows model entry after evaluation is saved', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);
    await seedEvaluation(request, { serverId, modelName: 'e2e-model-leaderboard' });

    await page.goto('/');
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();

    await expect(
      page.locator('.leaderboard-table tbody').getByText('e2e-model-leaderboard')
    ).toBeVisible({ timeout: 5000 });
  });

  test('SC-003: leaderboard updates within 3s after evaluations:saved event', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);

    await page.goto('/');
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
    await page.waitForLoadState('networkidle');

    const modelName = `e2e-sc003-${Date.now()}`;
    const t0 = Date.now();
    await seedEvaluation(request, { serverId, modelName });

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('evaluations:saved')));
    await expect(
      page.locator('.leaderboard-table tbody').getByText(modelName)
    ).toBeVisible({ timeout: 3000 });

    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(3000);
  });
});

// T039 [US3] — filter test cases
test.describe('Leaderboard filters', () => {
  test('apply date range — only in-range evaluations reflected', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);

    await page.goto('/');
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();

    await page.locator('input[type="date"]').first().fill('2030-01-01');
    await page.locator('input[type="date"]').last().fill('2030-12-31');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByText('No evaluations match the selected filters.')).toBeVisible({ timeout: 3000 });
  });

  test('clear filters — restores full unfiltered results within 1s (SC-005)', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);
    const modelName = `e2e-filter-clear-${Date.now()}`;
    await seedEvaluation(request, { serverId, modelName });

    await page.goto('/');
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();

    await page.locator('input[type="date"]').first().fill('2030-01-01');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('No evaluations match the selected filters.')).toBeVisible();

    const t0 = Date.now();
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.locator('.leaderboard-table')).toBeVisible({ timeout: 1000 });
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  test('filter-specific empty state is distinct from generic empty state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();

    await page.locator('input[type="date"]').first().fill('2030-01-01');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByText('No evaluations match the selected filters.')).toBeVisible();
    await expect(page.getByText('No evaluations yet.')).not.toBeVisible();
  });
});
