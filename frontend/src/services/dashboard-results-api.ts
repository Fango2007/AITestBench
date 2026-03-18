import { apiGet, apiPost } from './api.js';

export type DashboardViewMode = 'separate' | 'grouped';

export interface DashboardFilterSet {
  runtime_keys: string[];
  server_versions: string[];
  model_ids: string[];
  test_ids: string[];
  date_from?: string;
  date_to?: string;
  view_mode: DashboardViewMode;
  group_keys: string[];
  cursor: string | null;
  limit: number;
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
  series?: Array<{ label: string; points: Array<{ x: string | number; y: number | null }> }>;
  rows?: Array<Record<string, string | number | boolean | null>>;
  missing_fields: string[];
}

export interface DashboardFilterOptions {
  runtimes: Array<{ key: string; label: string; count: number }>;
  server_versions: Array<{ key: string; label: string; count: number }>;
  models: Array<{ model_id: string; display_name: string; count: number }>;
  tests: Array<{ test_id: string; label: string; count: number; has_performance_data: boolean }>;
  date_bounds: { min: string; max: string };
  default_window_days: number;
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

export async function getDashboardFilterOptions(input?: {
  date_from?: string;
  date_to?: string;
}): Promise<DashboardFilterOptions> {
  const params = new URLSearchParams();
  if (input?.date_from) {
    params.set('date_from', input.date_from);
  }
  if (input?.date_to) {
    params.set('date_to', input.date_to);
  }
  const query = params.toString();
  return apiGet<DashboardFilterOptions>(`/dashboard-results/filters${query ? `?${query}` : ''}`);
}

export async function queryDashboardResults(input: Partial<DashboardFilterSet>): Promise<DashboardQueryResponse> {
  return apiPost<DashboardQueryResponse>('/dashboard-results/query', input);
}
