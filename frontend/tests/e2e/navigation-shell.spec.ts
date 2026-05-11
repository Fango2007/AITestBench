import { expect, test } from '@playwright/test';

function catalogServer(serverId: string, name: string, modelId: string) {
  return {
    inference_server: {
      server_id: serverId,
      display_name: name,
      active: true,
      archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      archived_at: null
    },
    runtime: {
      retrieved_at: '2026-01-01T00:00:00.000Z',
      source: 'server',
      server_software: { name: 'inferencer', version: '1.0.0', build: null },
      api: { schema_family: ['openai-compatible'], api_version: null },
      platform: { os: { name: 'macos', version: null, arch: 'arm64' }, container: { type: 'none', image: null } },
      hardware: { cpu: { model: null, cores: null }, gpu: [{ vendor: 'apple', model: 'Metal', vram_mb: null }], ram_mb: null }
    },
    endpoints: { base_url: `http://${serverId}.local`, health_url: null, https: false },
    auth: { type: 'none', header_name: 'Authorization', token_env: null },
    capabilities: {
      server: { streaming: true, models_endpoint: true },
      generation: { text: true, json_schema_output: true, tools: true, embeddings: false },
      multimodal: { vision: { input_images: false, output_images: false }, audio: { input_audio: false, output_audio: false } },
      reasoning: { exposed: false, token_budget_configurable: false },
      concurrency: { parallel_requests: true, parallel_tool_calls: false, max_concurrent_requests: null },
      enforcement: 'server'
    },
    discovery: {
      retrieved_at: '2026-01-01T00:00:00.000Z',
      ttl_seconds: 3600,
      model_list: {
        raw: {},
        normalised: [{ model_id: modelId, display_name: modelId, context_window_tokens: 4096, quantisation: { method: 'mlx', bits: null, group_size: null, weight_format: 'MLX' } }]
      }
    },
    raw: {}
  };
}

function catalogModel(serverId: string, modelId: string, provider: string, format: string) {
  return {
    model: {
      server_id: serverId,
      model_id: modelId,
      display_name: modelId,
      active: true,
      archived: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      archived_at: null,
      base_model_name: modelId
    },
    identity: {
      provider,
      family: null,
      version: null,
      revision: null,
      checksum: null,
      quantized_provider: null
    },
    architecture: {
      type: 'unknown',
      parameter_count: null,
      parameter_count_label: null,
      active_parameter_label: null,
      precision: 'unknown',
      quantisation: { method: 'mlx', bits: null, group_size: null, weight_format: 'MLX' },
      format
    },
    capabilities: {
      generation: { text: true, json_schema_output: false, tools: false, embeddings: false },
      multimodal: { vision: false, audio: false },
      reasoning: { supported: false, explicit_tokens: false },
      use_case: { thinking: false, coding: false, instruct: false, mixture_of_experts: false }
    },
    limits: {
      context_window_tokens: 4096,
      max_output_tokens: null,
      max_images: null,
      max_batch_size: null
    },
    raw: {}
  };
}

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
  await expect(page.locator('.context-bar').getByText('Params')).toBeVisible();
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

test('run keeps page and workspace headers', async ({ page }) => {
  await page.goto('/run');
  await expect(page.locator('.merged-page-header').getByRole('heading', { name: 'Run' })).toBeVisible();
  await expect(page.locator('.context-bar').getByText('Params')).toBeVisible();
  await expect(page.locator('.run-page-header').getByRole('heading', { name: 'Run' })).toBeVisible();
});

test('catalog models funnel aligns staged rail controls', async ({ page }) => {
  const servers = [
    catalogServer('srv-a', 'Inferencer', 'mistral:latest'),
    catalogServer('srv-b', 'InferencerPro', 'qwen:latest')
  ];
  const models = [
    catalogModel('srv-a', 'mistral:latest', 'mistral', 'MLX'),
    catalogModel('srv-b', 'qwen:latest', 'qwen', 'MLX')
  ];
  await page.addInitScript(() => {
    window.localStorage.removeItem('catalog.serverStageCollapsed');
    window.localStorage.removeItem('catalog.modelFilterStageCollapsed');
  });
  await page.route('**/system/connectivity-config', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ poll_interval_ms: 60000 }) });
  });
  await page.route('**/inference-servers/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: servers.map((server) => ({ server_id: server.inference_server.server_id, ok: true, status_code: 200, response_time_ms: 12, checked_at: '2026-01-01T00:00:00.000Z' })) })
    });
  });
  await page.route('**/inference-servers?*', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(servers) });
  });
  await page.route('**/inference-servers', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(servers) });
  });
  await page.route('**/models', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(models) });
  });

  await page.goto('/catalog?tab=models');
  const catalogPage = page.locator('.catalog-models');
  await expect(catalogPage.locator('.catalog-stage-number')).toHaveText(['1']);

  await page.locator('.catalog-server-stage .server-filter-row').filter({ hasText: 'srv-a.local' }).getByRole('checkbox').check();
  await expect(catalogPage.locator('.catalog-stage-number')).toHaveText(['1', '2']);
  const modelFilterRail = page.locator('.catalog-model-filter-stage');
  await expect(modelFilterRail.getByText('Models')).toBeVisible();
  await expect(modelFilterRail.getByText('0 selected')).toBeVisible();
  await expect(modelFilterRail.getByRole('button', { name: 'Collapse' })).toBeVisible();

  await page.getByLabel('Mistral').check();
  await expect(modelFilterRail.getByText('1 selected')).toBeVisible();
  await expect(modelFilterRail.getByRole('button', { name: 'Clear' })).toBeVisible();
  await modelFilterRail.getByRole('button', { name: 'Collapse' }).click();
  await expect(modelFilterRail.getByText('Models · 1 selected')).toBeVisible();
  await modelFilterRail.getByRole('button', { name: '›' }).click();
  await expect(page.getByLabel('Mistral')).toBeChecked();
  await modelFilterRail.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.catalog-server-stage .server-filter-row').filter({ hasText: 'srv-a.local' }).getByRole('checkbox')).toBeChecked();
  await expect(page.getByLabel('Mistral')).not.toBeChecked();
});
