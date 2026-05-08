import { expect, test } from '@playwright/test';

function resultsViewPayload(empty = false) {
  const rows = empty
    ? []
    : [
        {
          run_id: 'run-dashboard-1',
          status: 'pass',
          started_at: '2026-02-08T00:00:00.000Z',
          ended_at: '2026-02-08T00:00:10.000Z',
          duration_ms: 10000,
          server_id: 'srv-local',
          server_name: 'Local Server',
          model_name: 'mistral:latest',
          template_id: 'latency-benchmark',
          template_label: 'latency-benchmark',
          score: 100,
          latency_ms: 80,
          cost: 0.001,
          tags: ['nightly'],
          result_count: 1
        }
      ];

  return {
    filters_applied: {
      date_from: '2026-02-01T00:00:00.000Z',
      date_to: '2026-02-09T00:00:00.000Z',
      server_ids: [],
      model_names: [],
      template_ids: [],
      statuses: [],
      tags: [],
      score_min: null,
      score_max: null,
      sort_by: 'started_at',
      sort_dir: 'desc',
      page: 1,
      page_size: 50
    },
    filter_options: {
      servers: [{ id: 'srv-local', label: 'Local Server', count: 1 }],
      models: [{ id: 'mistral:latest', label: 'mistral:latest', count: 1 }],
      templates: [{ id: 'latency-benchmark', label: 'latency-benchmark', kind: 'JSON', count: 1 }],
      statuses: [{ id: 'pass', label: 'pass', count: 1 }],
      tags: [{ id: 'nightly', label: 'nightly', count: 1 }],
      date_bounds: {
        min: empty ? null : '2026-02-08T00:00:00.000Z',
        max: empty ? null : '2026-02-08T00:00:00.000Z'
      }
    },
    dashboard: {
      scorecards: {
        total_runs: rows.length,
        pass_rate: rows.length ? 100 : null,
        median_latency_ms: rows.length ? 80 : null,
        median_cost: rows.length ? 0.001 : null
      },
      pass_rate_series: rows.length
        ? [{ label: 'mistral:latest', points: [{ x: '2026-02-08', y: 100 }] }]
        : [],
      latency_series: rows.length
        ? [{ label: 'mistral:latest', points: [{ x: '2026-02-08T00:00:00.000Z', y: 80 }] }]
        : [],
      recent_runs: rows
    },
    history: {
      rows,
      page: 1,
      page_size: 50,
      total: rows.length,
      total_pages: 1
    }
  };
}

test('merged Results dashboard filter and render flow', async ({ page }) => {
  await page.route('**/results-view/query', async (route) => {
    const payload = route.request().postDataJSON() as { date_from?: string };
    const isFutureRange = payload.date_from
      ? Date.parse(payload.date_from) >= Date.parse('2029-12-31T00:00:00.000Z')
      : false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(resultsViewPayload(isFutureRange))
    });
  });

  await page.route('**/results-view/runs/run-dashboard-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        run: resultsViewPayload().history.rows[0],
        raw_run: { id: 'run-dashboard-1', status: 'completed' },
        results: [
          {
            id: 'result-dashboard-1',
            test_id: 'latency-benchmark',
            template_label: 'latency-benchmark',
            verdict: 'pass',
            metrics: { latency_ms: 80 }
          }
        ],
        documents: [{ summary: { passed_steps: 1, failed_steps: 0 } }]
      })
    });
  });

  await page.goto('/results?tab=dashboard');

  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Dashboard/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[aria-label="Results filters"]')).toBeVisible();
  await expect(page.getByText('Total runs')).toBeVisible();
  await expect(page.getByText('Pass rate')).toBeVisible();
  await expect(page.locator('.dashboard-panel')).toHaveCount(2);
  await expect(page.locator('[data-panel-type="graph"]').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent runs' })).toBeVisible();

  const recentRun = page.locator('.results-run-row').filter({ hasText: 'latency-benchmark' });
  await expect(recentRun).toBeVisible();
  await recentRun.click();
  await expect(page.getByText('Run detail')).toBeVisible();
  await expect(page.getByText('run-dashboard-1')).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByLabel('From').fill('2030-01-01T00:00');
  await expect(page.getByText('No runs match the current filters.')).toBeVisible();
});
