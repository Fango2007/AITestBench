import { getDb } from '../models/db.js';
import { parseJson } from '../models/repositories.js';
import { logEvent, recordMetric } from './observability.js';

const DEFAULT_WINDOW_DAYS = 15;
const MAX_WINDOW_DAYS = 365;
const MAX_RAW_RESULTS = 5000;
const DEFAULT_PANEL_LIMIT = 100;
const MAX_PANEL_LIMIT = 200;

type RuntimeSnapshot = {
  server_software?: {
    version?: string | null;
  };
  api?: {
    schema_family?: string[];
    api_version?: string | null;
  };
  version?: string | null;
};

type EnvironmentSnapshot = {
  effective_config?: {
    model?: string;
  };
  model?: string;
};

type QueryRow = {
  test_result_id: string;
  test_id: string;
  template_id: string | null;
  test_definition_name: string | null;
  metrics: string | null;
  artefacts: string | null;
  raw_events: string | null;
  failure_reason: string | null;
  result_started_at: string;
  result_ended_at: string | null;
  run_id: string;
  inference_server_id: string;
  server_display_name: string | null;
  run_started_at: string;
  environment_snapshot: string | null;
  server_runtime: string;
};

export interface DashboardFilterSet {
  runtime_keys: string[];
  server_versions: string[];
  model_ids: string[];
  test_ids: string[];
  date_from: string;
  date_to: string;
  view_mode: 'separate' | 'grouped';
  group_keys: string[];
  cursor: string | null;
  limit: number;
}

export interface DashboardFilterOptionsResponse {
  runtimes: Array<{ key: string; label: string; count: number }>;
  server_versions: Array<{ key: string; label: string; count: number }>;
  models: Array<{ model_id: string; display_name: string; count: number }>;
  tests: Array<{ test_id: string; label: string; count: number; has_performance_data: boolean }>;
  date_bounds: { min: string; max: string };
  default_window_days: number;
}

interface DashboardSeriesPoint {
  x: string | number;
  y: number | null;
}

interface DashboardSeries {
  label: string;
  points: DashboardSeriesPoint[];
}

export interface DashboardPanel {
  panel_id: string;
  presentation_type: 'performance_graph' | 'data_table';
  title: string;
  runtime_key: string | null;
  server_version: string | null;
  model_id: string | null;
  test_ids: string[];
  metric_keys: string[];
  unit_keys: string[];
  grouped: boolean;
  series?: DashboardSeries[];
  rows?: Array<Record<string, string | number | boolean | null>>;
  missing_fields: string[];
}

export interface DashboardQueryResponse {
  filters_applied: DashboardFilterSet;
  panels: DashboardPanel[];
  page: { cursor: string | null; has_more: boolean; total_panels_estimate: number | null };
  stats: {
    raw_results_scanned: number;
    raw_results_returned: number;
    query_duration_ms: number;
    truncated: boolean;
  };
  warnings: string[];
}

function parseIso(value: string): number {
  return Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.NaN;
}

function defaultDateRange(now = new Date()): { date_from: string; date_to: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - DEFAULT_WINDOW_DAYS);
  return { date_from: from.toISOString(), date_to: to.toISOString() };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .filter((entry) => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );
}

export function validateAndNormalizeDashboardInput(
  payload: Record<string, unknown> | undefined,
  now = new Date()
): { ok: true; value: DashboardFilterSet } | { ok: false; error: string; code: string; details?: Record<string, unknown> } {
  const body = payload ?? {};
  const defaults = defaultDateRange(now);

  const runtime_keys = normalizeStringArray(body.runtime_keys);
  const server_versions = normalizeStringArray(body.server_versions);
  const model_ids = normalizeStringArray(body.model_ids);
  const test_ids = normalizeStringArray(body.test_ids);
  const group_keys = normalizeStringArray(body.group_keys);

  const date_from = typeof body.date_from === 'string' && body.date_from.trim() ? body.date_from : defaults.date_from;
  const date_to = typeof body.date_to === 'string' && body.date_to.trim() ? body.date_to : defaults.date_to;

  const fromMs = parseIso(date_from);
  const toMs = parseIso(date_to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return { ok: false, code: 'INVALID_DATE_RANGE', error: 'Invalid date range', details: { date_from, date_to } };
  }
  if (fromMs > toMs) {
    return { ok: false, code: 'INVALID_DATE_RANGE', error: 'date_from must be before date_to' };
  }
  const maxSpanMs = MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (toMs - fromMs > maxSpanMs) {
    return {
      ok: false,
      code: 'DATE_RANGE_TOO_LARGE',
      error: `Date range cannot exceed ${MAX_WINDOW_DAYS} days`
    };
  }

  const view_mode = body.view_mode === 'grouped' ? 'grouped' : 'separate';
  if (view_mode === 'grouped' && group_keys.length === 0) {
    return { ok: false, code: 'GROUP_KEYS_REQUIRED', error: 'group_keys are required when view_mode is grouped' };
  }

  const cursor = typeof body.cursor === 'string' && body.cursor.trim() ? body.cursor : null;
  const rawLimit = typeof body.limit === 'number' && Number.isInteger(body.limit) ? body.limit : DEFAULT_PANEL_LIMIT;
  const limit = Math.min(Math.max(rawLimit, 1), MAX_PANEL_LIMIT);

  return {
    ok: true,
    value: {
      runtime_keys,
      server_versions,
      model_ids,
      test_ids,
      date_from,
      date_to,
      view_mode,
      group_keys,
      cursor,
      limit
    }
  };
}

function runtimeKey(row: QueryRow, runtimeSnapshot: RuntimeSnapshot | null): string {
  return row.server_display_name ?? row.inference_server_id ?? runtimeSnapshot?.api?.schema_family?.[0] ?? 'unknown';
}

function runtimeVersion(runtimeSnapshot: RuntimeSnapshot | null): string {
  const serverSoftwareVersion = runtimeSnapshot?.server_software?.version?.trim();
  if (serverSoftwareVersion) {
    return serverSoftwareVersion;
  }
  const apiVersion = runtimeSnapshot?.api?.api_version?.trim();
  if (apiVersion) {
    return apiVersion;
  }
  const runtimeVersionValue = runtimeSnapshot?.version?.trim();
  if (runtimeVersionValue) {
    return runtimeVersionValue;
  }
  return 'unknown';
}

function selectedModel(snapshot: EnvironmentSnapshot | null): string {
  return snapshot?.effective_config?.model ?? snapshot?.model ?? 'unknown';
}

function isPerformanceMetricKey(key: string): boolean {
  return /(latency|throughput|tokens|ttfb|ms|sec|time|duration)/i.test(key);
}

function readNumericMetric(metrics: Record<string, unknown> | null): { key: string; value: number } | null {
  if (!metrics) {
    return null;
  }
  for (const [key, value] of Object.entries(metrics)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { key, value };
    }
  }
  return null;
}

function classifyPanel(metrics: Record<string, unknown> | null): 'performance_graph' | 'data_table' {
  if (!metrics) {
    return 'data_table';
  }
  const numericKeys = Object.keys(metrics).filter((key) => typeof metrics[key] === 'number');
  if (numericKeys.some(isPerformanceMetricKey)) {
    return 'performance_graph';
  }
  return 'data_table';
}

function panelGroupKey(panel: DashboardPanel): string {
  const metric = panel.metric_keys[0] ?? 'none';
  return `runtime:${panel.runtime_key ?? 'unknown'}|model:${panel.model_id ?? 'unknown'}|metric:${metric}`;
}

function compatibilitySignature(panel: DashboardPanel): string {
  return [
    panel.presentation_type,
    panel.metric_keys.slice().sort().join(','),
    panel.unit_keys.slice().sort().join(',')
  ].join('|');
}

function rowToPanel(row: QueryRow): DashboardPanel {
  const metrics = parseJson<Record<string, unknown>>(row.metrics);
  const artefacts = parseJson<Record<string, unknown>>(row.artefacts);
  const runtimeSnapshot = parseJson<RuntimeSnapshot>(row.server_runtime);
  const environmentSnapshot = parseJson<EnvironmentSnapshot>(row.environment_snapshot);

  const presentationType = classifyPanel(metrics);
  const metricSample = readNumericMetric(metrics);
  const missingFields: string[] = [];
  if (!metrics) {
    missingFields.push('metrics');
  }
  if (!artefacts) {
    missingFields.push('artefacts');
  }

  const runtime = runtimeKey(row, runtimeSnapshot);
  const basePanel: DashboardPanel = {
    panel_id: row.test_result_id,
    presentation_type: presentationType,
    title: row.test_id,
    runtime_key: runtime,
    server_version: runtimeVersion(runtimeSnapshot),
    model_id: selectedModel(environmentSnapshot),
    test_ids: [row.test_id],
    metric_keys: metricSample ? [metricSample.key] : [],
    unit_keys: [],
    grouped: false,
    missing_fields: missingFields
  };

  if (presentationType === 'performance_graph') {
    basePanel.series = [
      {
        label: metricSample?.key ?? row.test_id,
        points: [{ x: row.run_started_at, y: metricSample?.value ?? null }]
      }
    ];
  } else {
    basePanel.rows = [
      {
        test_result_id: row.test_result_id,
        run_id: row.run_id,
        test_id: row.test_id,
        runtime: basePanel.runtime_key,
        server_version: basePanel.server_version,
        model_id: basePanel.model_id,
        failure_reason: row.failure_reason,
        ...(metrics ?? {}),
        ...(artefacts ?? {})
      }
    ];
  }

  return basePanel;
}

function aggregatePanels(rows: QueryRow[]): DashboardPanel[] {
  const performancePanels = new Map<
    string,
    {
      panel: DashboardPanel;
      seriesByTest: Map<string, DashboardSeriesPoint[]>;
      testIds: Set<string>;
    }
  >();
  const tablePanels = new Map<string, DashboardPanel>();

  for (const row of rows) {
    const metrics = parseJson<Record<string, unknown>>(row.metrics);
    const runtimeSnapshot = parseJson<RuntimeSnapshot>(row.server_runtime);
    const envSnapshot = parseJson<EnvironmentSnapshot>(row.environment_snapshot);
    const runtime = runtimeKey(row, runtimeSnapshot);
    const version = runtimeVersion(runtimeSnapshot);
    const model = selectedModel(envSnapshot);
    const performanceKeys = Object.keys(metrics ?? {}).filter(
      (key) => typeof metrics?.[key] === 'number' && isPerformanceMetricKey(key)
    );

    if (performanceKeys.length > 0) {
      for (const metricKey of performanceKeys) {
        const key = `perf|${runtime}|${version}|${model}|${metricKey}`;
        const metricValue = metrics?.[metricKey] as number;
        const existing = performancePanels.get(key);
        if (!existing) {
          const panel: DashboardPanel = {
            panel_id: key,
            presentation_type: 'performance_graph',
            title: metricKey,
            runtime_key: runtime,
            server_version: version,
            model_id: model,
            test_ids: [row.test_id],
            metric_keys: [metricKey],
            unit_keys: [],
            grouped: false,
            series: [],
            missing_fields: metrics ? [] : ['metrics']
          };
          performancePanels.set(key, {
            panel,
            seriesByTest: new Map([[row.test_id, [{ x: row.run_started_at, y: metricValue }]]]),
            testIds: new Set([row.test_id])
          });
          continue;
        }
        const points = existing.seriesByTest.get(row.test_id) ?? [];
        points.push({ x: row.run_started_at, y: metricValue });
        existing.seriesByTest.set(row.test_id, points);
        existing.testIds.add(row.test_id);
        existing.panel.missing_fields = Array.from(new Set(existing.panel.missing_fields));
      }
      continue;
    }

    const tableKey = `table|${runtime}|${version}|${model}`;
    const basePanel = rowToPanel(row);
    if (!tablePanels.has(tableKey)) {
      tablePanels.set(tableKey, {
        ...basePanel,
        panel_id: tableKey,
        title: 'Non-performance results',
        test_ids: [],
        rows: []
      });
    }
    const target = tablePanels.get(tableKey)!;
    target.test_ids = Array.from(new Set([...target.test_ids, row.test_id]));
    target.rows = [...(target.rows ?? []), ...(basePanel.rows ?? [])];
    target.missing_fields = Array.from(new Set([...target.missing_fields, ...basePanel.missing_fields]));
  }

  for (const entry of performancePanels.values()) {
    entry.panel.test_ids = Array.from(entry.testIds);
    entry.panel.series = Array.from(entry.seriesByTest.entries()).map(([testId, points]) => ({
      label: testId,
      points: points.sort((a, b) => String(a.x).localeCompare(String(b.x)))
    }));
  }

  return [
    ...Array.from(performancePanels.values()).map((entry) => entry.panel),
    ...Array.from(tablePanels.values())
  ];
}

function groupedPanelFrom(base: DashboardPanel[]): DashboardPanel {
  const first = base[0];
  const allTests = Array.from(new Set(base.flatMap((panel) => panel.test_ids)));

  if (first.presentation_type === 'performance_graph') {
    const mergedSeries: DashboardSeries[] = [];
    for (const panel of base) {
      for (const series of panel.series ?? []) {
        mergedSeries.push({
          label: `${panel.title}:${series.label}`,
          points: [...series.points]
        });
      }
    }
    return {
      ...first,
      panel_id: `grouped:${base.map((panel) => panel.panel_id).join(',')}`,
      title: `Grouped: ${allTests.join(', ')}`,
      test_ids: allTests,
      grouped: true,
      series: mergedSeries,
      rows: undefined,
      missing_fields: Array.from(new Set(base.flatMap((panel) => panel.missing_fields)))
    };
  }

  const mergedRows = base.flatMap((panel) => panel.rows ?? []);
  return {
    ...first,
    panel_id: `grouped:${base.map((panel) => panel.panel_id).join(',')}`,
    title: `Grouped: ${allTests.join(', ')}`,
    test_ids: allTests,
    grouped: true,
    rows: mergedRows,
    series: undefined,
    missing_fields: Array.from(new Set(base.flatMap((panel) => panel.missing_fields)))
  };
}

function fetchQueryRows(filters: DashboardFilterSet): QueryRow[] {
  const db = getDb();
  // Query uses started_at + run_id paths that align with existing indexes on runs/test_results.
  const clauses: string[] = ['r.started_at >= ?', 'r.started_at <= ?'];
  const args: unknown[] = [filters.date_from, filters.date_to];

  const sql = `
    SELECT
      tr.id as test_result_id,
      tr.test_id,
      at.template_id,
      td.name as test_definition_name,
      tr.metrics,
      tr.artefacts,
      tr.raw_events,
      tr.failure_reason,
      tr.started_at as result_started_at,
      tr.ended_at as result_ended_at,
      r.id as run_id,
      r.inference_server_id,
      i.display_name as server_display_name,
      r.started_at as run_started_at,
      r.environment_snapshot,
      i.runtime as server_runtime
    FROM test_results tr
    JOIN runs r ON r.id = tr.run_id
    LEFT JOIN inference_servers i ON i.server_id = r.inference_server_id
    LEFT JOIN active_tests at ON at.id = tr.test_id
    LEFT JOIN test_definitions td ON td.id = tr.test_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY r.started_at DESC
    LIMIT ${MAX_RAW_RESULTS + 1}
  `;

  return db.prepare(sql).all(...args) as QueryRow[];
}

function applySecondaryFilters(rows: QueryRow[], filters: DashboardFilterSet): QueryRow[] {
  return rows.filter((row) => {
    const runtimeSnapshot = parseJson<RuntimeSnapshot>(row.server_runtime);
    const envSnapshot = parseJson<EnvironmentSnapshot>(row.environment_snapshot);
    const key = runtimeKey(row, runtimeSnapshot);
    const version = runtimeVersion(runtimeSnapshot);
    const model = selectedModel(envSnapshot);

    if (filters.runtime_keys.length > 0 && !filters.runtime_keys.includes(key)) {
      return false;
    }
    if (filters.server_versions.length > 0 && !filters.server_versions.includes(version)) {
      return false;
    }
    if (filters.model_ids.length > 0 && !filters.model_ids.includes(model)) {
      return false;
    }
    if (filters.test_ids.length > 0 && !filters.test_ids.includes(templateFilterKey(row))) {
      return false;
    }
    return true;
  });
}

function paginatePanels(panels: DashboardPanel[], cursor: string | null, limit: number) {
  const start = cursor ? Math.max(Number.parseInt(cursor, 10), 0) : 0;
  const boundedStart = Number.isFinite(start) ? start : 0;
  const slice = panels.slice(boundedStart, boundedStart + limit);
  const nextStart = boundedStart + slice.length;
  return {
    panels: slice,
    has_more: nextStart < panels.length,
    cursor: nextStart < panels.length ? String(nextStart) : null,
    total_panels_estimate: panels.length
  };
}

function displayTemplateName(testName: string | null | undefined, testId: string): string {
  if (!testName || !testName.trim()) {
    return testId;
  }
  // Stored names are typically "<template name> (<model>)"; keep only template name for filter display.
  const withoutModel = testName.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return withoutModel || testName.trim();
}

function templateFilterKey(row: QueryRow): string {
  const explicitTemplate = row.template_id?.trim();
  if (explicitTemplate) {
    return explicitTemplate;
  }
  return displayTemplateName(row.test_definition_name, row.test_id);
}

function templateFilterLabel(row: QueryRow): string {
  const fromDefinition = displayTemplateName(row.test_definition_name, row.test_id);
  if (fromDefinition !== row.test_id) {
    return fromDefinition;
  }
  return row.template_id?.trim() || fromDefinition;
}

export function listDashboardFilterOptions(
  payload: Record<string, unknown> | undefined
): { ok: true; value: DashboardFilterOptionsResponse } | { ok: false; error: string; code: string } {
  const normalized = validateAndNormalizeDashboardInput(payload);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error, code: normalized.code };
  }

  const rows = applySecondaryFilters(fetchQueryRows(normalized.value), normalized.value).slice(0, MAX_RAW_RESULTS);

  const db = getDb();
  const runtimeCounts = new Map<string, number>();
  const versionCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const testCounts = new Map<string, { label: string; count: number; hasPerformance: boolean }>();

  let minDate = '';
  let maxDate = '';

  for (const row of rows) {
    const runtimeSnapshot = parseJson<RuntimeSnapshot>(row.server_runtime);
    const envSnapshot = parseJson<EnvironmentSnapshot>(row.environment_snapshot);
    const runtime = runtimeKey(row, runtimeSnapshot);
    const version = runtimeVersion(runtimeSnapshot);
    const model = selectedModel(envSnapshot);

    runtimeCounts.set(runtime, (runtimeCounts.get(runtime) ?? 0) + 1);
    versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
    modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);

    const metrics = parseJson<Record<string, unknown>>(row.metrics);
    const hasPerformance = classifyPanel(metrics) === 'performance_graph';
    const testKey = templateFilterKey(row);
    const currentTest = testCounts.get(testKey) ?? { label: templateFilterLabel(row), count: 0, hasPerformance: false };
    testCounts.set(testKey, {
      label: currentTest.label,
      count: currentTest.count + 1,
      hasPerformance: currentTest.hasPerformance || hasPerformance
    });

    if (!minDate || row.run_started_at < minDate) {
      minDate = row.run_started_at;
    }
    if (!maxDate || row.run_started_at > maxDate) {
      maxDate = row.run_started_at;
    }
  }

  const allRuntimes = db
    .prepare('SELECT server_id, display_name FROM inference_servers ORDER BY display_name ASC')
    .all() as Array<{ server_id: string; display_name: string }>;
  for (const runtime of allRuntimes) {
    if (!runtimeCounts.has(runtime.display_name)) {
      runtimeCounts.set(runtime.display_name, 0);
    }
  }

  return {
    ok: true,
    value: {
      runtimes: Array.from(runtimeCounts.entries()).map(([key, count]) => ({ key, label: key, count })),
      server_versions: Array.from(versionCounts.entries()).map(([key, count]) => ({ key, label: key, count })),
      models: Array.from(modelCounts.entries()).map(([model_id, count]) => ({ model_id, display_name: model_id, count })),
      tests: Array.from(testCounts.entries()).map(([testKey, data]) => ({
        test_id: testKey,
        label: data.label,
        count: data.count,
        has_performance_data: data.hasPerformance
      })),
      date_bounds: {
        min: minDate || normalized.value.date_from,
        max: maxDate || normalized.value.date_to
      },
      default_window_days: DEFAULT_WINDOW_DAYS
    }
  };
}

export function queryDashboardResults(
  payload: Record<string, unknown> | undefined
): { ok: true; value: DashboardQueryResponse } | { ok: false; error: string; code: string; details?: Record<string, unknown> } {
  const started = Date.now();
  const normalized = validateAndNormalizeDashboardInput(payload);
  if (!normalized.ok) {
    return normalized;
  }

  const fetchedRows = fetchQueryRows(normalized.value);
  const truncated = fetchedRows.length > MAX_RAW_RESULTS;
  const rows = applySecondaryFilters(fetchedRows.slice(0, MAX_RAW_RESULTS), normalized.value);

  const panels = aggregatePanels(rows);
  let materializedPanels = panels;
  const warnings: string[] = [];

  if (normalized.value.view_mode === 'grouped') {
    const byKey = new Map<string, DashboardPanel[]>();
    const passthroughPanels: DashboardPanel[] = [];
    for (const panel of panels) {
      const key = panelGroupKey(panel);
      if (!normalized.value.group_keys.includes(key)) {
        passthroughPanels.push(panel);
        continue;
      }
      const group = byKey.get(key) ?? [];
      group.push(panel);
      byKey.set(key, group);
    }

    for (const requestedKey of normalized.value.group_keys) {
      if (!byKey.has(requestedKey)) {
        return {
          ok: false,
          code: 'INCOMPATIBLE_GROUPING',
          error: `Grouping key ${requestedKey} does not match any compatible panels`,
          details: { group_key: requestedKey }
        };
      }
    }

    const groupedPanels: DashboardPanel[] = [];
    for (const [groupKey, groupPanels] of byKey.entries()) {
      const signatures = Array.from(new Set(groupPanels.map(compatibilitySignature)));
      if (signatures.length > 1) {
        return {
          ok: false,
          code: 'INCOMPATIBLE_GROUPING',
          error: `Grouping key ${groupKey} is incompatible for selected panels`,
          details: { group_key: groupKey }
        };
      }
      groupedPanels.push(groupedPanelFrom(groupPanels));
    }

    materializedPanels = [...passthroughPanels, ...groupedPanels];
  }

  const page = paginatePanels(materializedPanels, normalized.value.cursor, normalized.value.limit);

  const durationMs = Date.now() - started;
  logEvent({
    level: 'info',
    message: 'Dashboard results queried',
    meta: {
      raw_results_scanned: fetchedRows.length,
      raw_results_returned: rows.length,
      panels_returned: page.panels.length,
      truncated,
      duration_ms: durationMs
    }
  });
  recordMetric({ name: 'dashboard_results_query_duration_ms', value: durationMs });

  if (truncated) {
    warnings.push('Result set truncated to 5000 raw rows');
  }

  return {
    ok: true,
    value: {
      filters_applied: normalized.value,
      panels: page.panels,
      page: {
        cursor: page.cursor,
        has_more: page.has_more,
        total_panels_estimate: page.total_panels_estimate
      },
      stats: {
        raw_results_scanned: fetchedRows.length,
        raw_results_returned: rows.length,
        query_duration_ms: durationMs,
        truncated
      },
      warnings
    }
  };
}
