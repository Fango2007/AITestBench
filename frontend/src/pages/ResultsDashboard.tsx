import { useEffect, useMemo, useState } from 'react';

import { ResultsFilters, ResultsFilterValue } from '../components/results-filters.js';
import { ResultsGraphPanel } from '../components/results-graph-panel.js';
import { ResultsTablePanel } from '../components/results-table-panel.js';
import {
  DashboardFilterOptions,
  DashboardPanel,
  getDashboardFilterOptions,
  queryDashboardResults
} from '../services/dashboard-results-api.js';
import '../styles/dashboard-results.css';

function toLocalInputValue(iso: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromLocal(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function buildInitialFilterValue(options: DashboardFilterOptions | null): ResultsFilterValue {
  return {
    runtime_keys: [],
    server_versions: [],
    model_ids: [],
    test_ids: [],
    date_from: options?.date_bounds?.min ? toLocalInputValue(options.date_bounds.min) : '',
    date_to: options?.date_bounds?.max ? toLocalInputValue(options.date_bounds.max) : '',
    view_mode: 'separate',
    group_keys_text: ''
  };
}

export function ResultsDashboard() {
  const [options, setOptions] = useState<DashboardFilterOptions | null>(null);
  const [filters, setFilters] = useState<ResultsFilterValue>(buildInitialFilterValue(null));
  const [panels, setPanels] = useState<DashboardPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [queryStats, setQueryStats] = useState<{ duration: number; returned: number } | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getDashboardFilterOptions()
      .then((data) => {
        if (!active) {
          return;
        }
        setOptions(data);
        setFilters((current) => {
          if (current.date_from || current.date_to) {
            return current;
          }
          return buildInitialFilterValue(data);
        });
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load filter options');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const requestPayload = useMemo(() => {
    const groupKeys = filters.group_keys_text
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    return {
      runtime_keys: filters.runtime_keys,
      server_versions: filters.server_versions,
      model_ids: filters.model_ids,
      test_ids: filters.test_ids,
      date_from: toIsoFromLocal(filters.date_from),
      date_to: toIsoFromLocal(filters.date_to),
      view_mode: filters.view_mode,
      group_keys: groupKeys,
      limit: 100,
      cursor: null
    };
  }, [filters]);

  const performancePanels = useMemo(
    () => panels.filter((panel) => panel.presentation_type === 'performance_graph'),
    [panels]
  );
  const tablePanels = useMemo(
    () => panels.filter((panel) => panel.presentation_type === 'data_table'),
    [panels]
  );

  const availableMetrics = useMemo(() => {
    return Array.from(
      new Set(
        performancePanels
          .map((panel) => panel.metric_keys[0] ?? panel.title)
          .filter((metric) => typeof metric === 'string' && metric.length > 0)
      )
    ).sort();
  }, [performancePanels]);

  useEffect(() => {
    if (availableMetrics.length === 0) {
      setSelectedMetric('');
      return;
    }
    if (!selectedMetric || !availableMetrics.includes(selectedMetric)) {
      setSelectedMetric(availableMetrics[0]);
    }
  }, [availableMetrics, selectedMetric]);

  const mergedMetricPanel = useMemo(() => {
    if (!selectedMetric) {
      return null;
    }
    const matching = performancePanels.filter(
      (panel) => (panel.metric_keys[0] ?? panel.title) === selectedMetric
    );
    if (matching.length === 0) {
      return null;
    }

    const first = matching[0];
    const mergedSeries = new Map<string, Array<{ x: string | number; y: number | null }>>();
    const mergedTests = new Set<string>();
    const mergedMissing = new Set<string>();

    for (const panel of matching) {
      for (const testId of panel.test_ids) {
        mergedTests.add(testId);
      }
      for (const missing of panel.missing_fields) {
        mergedMissing.add(missing);
      }
      for (const series of panel.series ?? []) {
        const points = mergedSeries.get(series.label) ?? [];
        points.push(...series.points);
        mergedSeries.set(series.label, points);
      }
    }

    const series = Array.from(mergedSeries.entries()).map(([label, points]) => ({
      label,
      points: points
        .slice()
        .sort((a, b) => String(a.x).localeCompare(String(b.x)))
    }));

    return {
      ...first,
      panel_id: `metric:${selectedMetric}`,
      title: selectedMetric,
      test_ids: Array.from(mergedTests),
      missing_fields: Array.from(mergedMissing),
      series
    } as DashboardPanel;
  }, [performancePanels, selectedMetric]);

  useEffect(() => {
    if (!options) {
      return;
    }
    let active = true;
    setQuerying(true);
    setError(null);

    queryDashboardResults(requestPayload)
      .then((response) => {
        if (!active) {
          return;
        }
        setPanels(response.panels);
        setWarnings(response.warnings);
        setQueryStats({ duration: response.stats.query_duration_ms, returned: response.stats.raw_results_returned });
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setPanels([]);
        setWarnings([]);
        setQueryStats(null);
        setError(err instanceof Error ? err.message : 'Unable to query dashboard results');
      })
      .finally(() => {
        if (active) {
          setQuerying(false);
        }
      });

    return () => {
      active = false;
    };
  }, [options, requestPayload]);

  return (
    <section className="page targets-page">
      <div className="page-header">
        <h1>Results Dashboard</h1>
        <p className="muted">Filter by runtime, server version, model, tests, and date range.</p>
      </div>

      <ResultsFilters options={options} value={filters} onChange={setFilters} loading={loading || querying} />

      {queryStats ? (
        <p className="muted dashboard-stats">
          Query duration: {queryStats.duration} ms | Raw rows returned: {queryStats.returned}
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="warning" role="status">
          {warnings.join(' ')}
        </div>
      ) : null}

      {error ? <div className="error">{error}</div> : null}
      {querying ? <p className="muted">Loading results...</p> : null}
      {!querying && !error && panels.length === 0 ? <p className="muted">No matching results for the selected filters.</p> : null}

      {availableMetrics.length > 0 ? (
        <section className="card dashboard-metric-selector">
          <label>
            Metric
            <select value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
              {availableMetrics.map((metric) => (
                <option key={metric} value={metric}>
                  {metric}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <div className="dashboard-panels">
        {mergedMetricPanel ? <ResultsGraphPanel key={mergedMetricPanel.panel_id} panel={mergedMetricPanel} /> : null}
        {tablePanels.map((panel) => (
          <ResultsTablePanel key={panel.panel_id} panel={panel} />
        ))}
      </div>
    </section>
  );
}
