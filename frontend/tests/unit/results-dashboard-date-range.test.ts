import { expect, test } from 'vitest';

import { mergePerformancePanelsForMetric, toLocalInputValue } from '../../src/pages/ResultsDashboard.js';
import type { DashboardPanel } from '../../src/services/dashboard-results-api.js';

test('rounds dashboard date_to up when source timestamp has seconds', () => {
  const value = toLocalInputValue('2026-05-04T17:54:05.123Z', 'to');

  expect(new Date(value).getTime()).toBeGreaterThanOrEqual(new Date('2026-05-04T17:54:05.123Z').getTime());
});

test('does not round dashboard date_from up', () => {
  const value = toLocalInputValue('2026-05-04T17:54:05.123Z', 'from');

  expect(new Date(value).getTime()).toBeLessThanOrEqual(new Date('2026-05-04T17:54:05.123Z').getTime());
});

function performancePanel(modelId: string, points: Array<{ x: string; y: number }>): DashboardPanel {
  return {
    panel_id: `perf:${modelId}`,
    presentation_type: 'performance_graph',
    title: 'cold_penalty_ms_median',
    runtime_key: 'Local Server',
    server_version: '1.1.0',
    model_id: modelId,
    test_ids: ['Cold_start_penalty'],
    metric_keys: ['cold_penalty_ms_median'],
    unit_keys: [],
    grouped: false,
    series: [{ label: 'Cold_start_penalty', points }],
    missing_fields: []
  };
}

test('keeps same-test metric lines separate per model in merged performance graph', () => {
  const merged = mergePerformancePanelsForMetric(
    [
      performancePanel('model-a', [
        { x: '2026-05-04T17:54:00.000Z', y: 100 },
        { x: '2026-05-04T17:55:00.000Z', y: 90 }
      ]),
      performancePanel('model-b', [
        { x: '2026-05-04T17:54:00.000Z', y: 130 },
        { x: '2026-05-04T17:55:00.000Z', y: 120 }
      ])
    ],
    'cold_penalty_ms_median'
  );

  expect(merged?.series).toHaveLength(2);
  expect(merged?.series?.map((series) => series.label)).toEqual([
    'model-a - Cold_start_penalty',
    'model-b - Cold_start_penalty'
  ]);
  expect(merged?.series?.map((series) => series.points)).toEqual([
    [
      { x: '2026-05-04T17:54:00.000Z', y: 100 },
      { x: '2026-05-04T17:55:00.000Z', y: 90 }
    ],
    [
      { x: '2026-05-04T17:54:00.000Z', y: 130 },
      { x: '2026-05-04T17:55:00.000Z', y: 120 }
    ]
  ]);
});
