import { expect, test } from '@playwright/test';

test('results dashboard filter and render flow', async ({ page }) => {
  await page.route('**/dashboard-results/filters**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runtimes: [{ key: 'Local Server', label: 'Local Server', count: 2 }],
        server_versions: [{ key: '1.0.0', label: '1.0.0', count: 2 }],
        models: [{ model_id: 'mistral:latest', display_name: 'Mistral', count: 2 }],
        tests: [
          { test_id: 'latency-benchmark', label: 'latency-benchmark', count: 1, has_performance_data: true },
          { test_id: 'metadata-check', label: 'metadata-check', count: 1, has_performance_data: false }
        ],
        date_bounds: {
          min: '2026-02-01T00:00:00.000Z',
          max: '2026-02-09T00:00:00.000Z'
        },
        default_window_days: 15
      })
    });
  });

  await page.route('**/dashboard-results/query', async (route) => {
    const request = route.request();
    const payload = request.postDataJSON() as { view_mode?: string; group_keys?: string[] };

    const grouped = payload.view_mode === 'grouped' && (payload.group_keys?.length ?? 0) > 0;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        filters_applied: {
          runtime_keys: ['Local Server'],
          server_versions: ['1.0.0'],
          model_ids: ['mistral:latest'],
          test_ids: ['latency-benchmark', 'metadata-check'],
          date_from: '2026-02-01T00:00:00.000Z',
          date_to: '2026-02-09T00:00:00.000Z',
          view_mode: grouped ? 'grouped' : 'separate',
          group_keys: grouped ? ['runtime:ollama|model:mistral:latest|metric:latency_ms'] : [],
          cursor: null,
          limit: 100
        },
        panels: [
          {
            panel_id: grouped ? 'grouped:1' : 'panel-1',
            presentation_type: 'performance_graph',
            title: grouped ? 'Grouped: latency-benchmark' : 'latency-benchmark',
            runtime_key: 'ollama',
            server_version: '1.0.0',
            model_id: 'mistral:latest',
            test_ids: ['latency-benchmark'],
            metric_keys: ['latency_ms'],
            unit_keys: [],
            grouped,
            series: [{ label: 'latency_ms', points: [{ x: '2026-02-08T00:00:00.000Z', y: 80 }] }],
            missing_fields: []
          },
          {
            panel_id: 'panel-2',
            presentation_type: 'data_table',
            title: 'metadata-check',
            runtime_key: 'ollama',
            server_version: '1.0.0',
            model_id: 'mistral:latest',
            test_ids: ['metadata-check'],
            metric_keys: [],
            unit_keys: [],
            grouped: false,
            rows: [{ test_result_id: 'r1', status_code: 200, response: 'ok' }],
            missing_fields: []
          }
        ],
        page: { cursor: null, has_more: false, total_panels_estimate: 2 },
        stats: { raw_results_scanned: 2, raw_results_returned: 2, query_duration_ms: 20, truncated: false },
        warnings: []
      })
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Results dashboard' }).click();

  await expect(page.getByRole('heading', { name: 'Results Dashboard' })).toBeVisible();
  await expect(page.getByLabel('Runtime')).toBeVisible();
  await expect(page.getByText('Query duration:')).toBeVisible();
  await expect(page.locator('.dashboard-panel')).toHaveCount(2);
  await expect(page.locator('[data-panel-type="graph"]')).toBeVisible();
  await expect(page.locator('[data-panel-type="table"]')).toBeVisible();

  await page.getByLabel('View Mode').selectOption('grouped');
  await page
    .getByLabel('Group Keys (comma-separated)')
    .fill('runtime:ollama|model:mistral:latest|metric:latency_ms');

  await expect(page.getByLabel('Metric')).toHaveValue('latency_ms');
  await expect(page.locator('[data-panel-type="graph"]').getByRole('heading', { name: 'latency_ms' })).toBeVisible();
});
