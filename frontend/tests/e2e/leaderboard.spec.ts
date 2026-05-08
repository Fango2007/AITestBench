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
const authHeaders: Record<string, string> = API_TOKEN ? { 'x-api-token': API_TOKEN } : {};

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
  test('renders the merged Results leaderboard tab and shared filter rail when no evaluations match', async ({ page }) => {
    await page.goto('/results?tab=leaderboard');
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Leaderboard' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[aria-label="Results filters"]')).toBeVisible();
    await expect(page.getByLabel('Sort by')).toBeVisible();
    await expect(page.getByLabel('Group by')).toBeVisible();
    await expect(page.getByText('No evaluations match the selected filters.')).toBeVisible();
  });
});

// T035 [US2] — populated state
test.describe('Leaderboard page — populated state', () => {
  test('shows a ranked model row after evaluation is saved and opens the evaluation drawer', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);
    await seedEvaluation(request, { serverId, modelName: 'e2e-model-leaderboard' });

    await page.goto('/results?tab=leaderboard');

    const row = page.locator('.results-leader-row').filter({ hasText: 'e2e-model-leaderboard' });
    await expect(row).toBeVisible({ timeout: 5000 });
    await expect(row.getByText('Score')).toBeVisible();
    await row.click();
    await expect(page.getByText('Evaluation detail')).toBeVisible();
    await expect(page.getByText('Test answer')).toBeVisible();
  });

  test('leaderboard updates within 3s after evaluations:saved event', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);

    await page.goto('/results?tab=leaderboard');
    await page.waitForLoadState('networkidle');

    const modelName = `e2e-sc003-${Date.now()}`;
    const t0 = Date.now();
    await seedEvaluation(request, { serverId, modelName });

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('evaluations:saved')));
    await expect(
      page.locator('.results-leader-row').filter({ hasText: modelName })
    ).toBeVisible({ timeout: 3000 });

    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(3000);
  });
});

// T039 [US3] — filter test cases
test.describe('Leaderboard filters', () => {
  test('shared date range rail filters evaluation-backed leaderboard entries', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);
    const modelName = `e2e-filter-rail-${Date.now()}`;
    await seedEvaluation(request, { serverId, modelName });

    await page.goto('/results?tab=leaderboard');
    await expect(page.locator('.results-leader-row').filter({ hasText: modelName })).toBeVisible();

    await page.getByLabel('From').fill('2030-01-01T00:00');
    await page.getByLabel('To').fill('2030-12-31T23:59');
    await expect(page.getByText('No evaluations match the selected filters.')).toBeVisible({ timeout: 3000 });
  });

  test('Reset filters restores the leaderboard view within 1s', async ({ page, request }) => {
    const serverId = await getOrCreateServer(request);
    const modelName = `e2e-filter-clear-${Date.now()}`;
    await seedEvaluation(request, { serverId, modelName });

    await page.goto('/results?tab=leaderboard');

    await page.getByLabel('From').fill('2030-01-01T00:00');
    await page.getByLabel('To').fill('2030-12-31T23:59');
    await expect(page.getByText('No evaluations match the selected filters.')).toBeVisible();

    const t0 = Date.now();
    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(page.locator('.results-leader-row').filter({ hasText: modelName })).toBeVisible({ timeout: 1000 });
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  test('sort and group controls are URL-backed on the merged leaderboard tab', async ({ page }) => {
    await page.goto('/results?tab=leaderboard');
    await page.getByLabel('Sort by').selectOption('latency');
    await expect(page).toHaveURL(/leader_sort=latency/);
    await page.getByLabel('Group by').selectOption('quantization');
    await expect(page).toHaveURL(/group_by=quantization/);
  });
});
