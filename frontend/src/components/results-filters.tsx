import { ChangeEvent } from 'react';

import { DashboardFilterOptions, DashboardViewMode } from '../services/dashboard-results-api.js';

export interface ResultsFilterValue {
  runtime_keys: string[];
  server_versions: string[];
  model_ids: string[];
  test_ids: string[];
  date_from: string;
  date_to: string;
  view_mode: DashboardViewMode;
  group_keys_text: string;
}

interface ResultsFiltersProps {
  options: DashboardFilterOptions | null;
  value: ResultsFilterValue;
  onChange: (next: ResultsFilterValue) => void;
  loading: boolean;
}

function pickSingle(event: ChangeEvent<HTMLSelectElement>): string[] {
  const value = event.target.value.trim();
  return value ? [value] : [];
}

export function ResultsFilters({ options, value, onChange, loading }: ResultsFiltersProps) {
  const disabled = loading || !options;

  return (
    <div className="dashboard-filters" aria-label="Results filters">
      <div className="dashboard-filters-row dashboard-filters-row-3">
        <div className="field">
          <label htmlFor="results-runtime-filter">Runtime</label>
          <select
            id="results-runtime-filter"
            value={value.runtime_keys[0] ?? ''}
            onChange={(event) => onChange({ ...value, runtime_keys: pickSingle(event) })}
            disabled={disabled}
          >
            <option value="">All runtimes</option>
            {options?.runtimes.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="results-version-filter">Server Version</label>
          <select
            id="results-version-filter"
            value={value.server_versions[0] ?? ''}
            onChange={(event) => onChange({ ...value, server_versions: pickSingle(event) })}
            disabled={disabled}
          >
            <option value="">All versions</option>
            {options?.server_versions.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="results-model-filter">Model</label>
          <select
            id="results-model-filter"
            value={value.model_ids[0] ?? ''}
            onChange={(event) => onChange({ ...value, model_ids: pickSingle(event) })}
            disabled={disabled}
          >
            <option value="">All models</option>
            {options?.models.map((entry) => (
              <option key={entry.model_id} value={entry.model_id}>
                {entry.display_name} ({entry.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dashboard-filters-row dashboard-filters-row-4">
        <div className="field">
          <label htmlFor="results-tests-filter">Tests</label>
          <select
            id="results-tests-filter"
            value={value.test_ids[0] ?? ''}
            onChange={(event) => onChange({ ...value, test_ids: pickSingle(event) })}
            disabled={disabled}
          >
            <option value="">All tests</option>
            {options?.tests.map((entry) => (
              <option key={entry.test_id} value={entry.test_id}>
                {entry.label} ({entry.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dashboard-filters-row dashboard-filters-row-3">
        <div className="field">
          <label htmlFor="results-date-from-filter">Date From</label>
          <input
            id="results-date-from-filter"
            type="datetime-local"
            value={value.date_from}
            onChange={(event) => onChange({ ...value, date_from: event.target.value })}
            disabled={disabled}
          />
        </div>

        <div className="field">
          <label htmlFor="results-date-to-filter">Date To</label>
          <input
            id="results-date-to-filter"
            type="datetime-local"
            value={value.date_to}
            onChange={(event) => onChange({ ...value, date_to: event.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label htmlFor="results-view-mode-filter">View Mode</label>
          <select
            id="results-view-mode-filter"
            value={value.view_mode}
            onChange={(event) => onChange({ ...value, view_mode: event.target.value as DashboardViewMode })}
            disabled={disabled}
          >
            <option value="separate">Separate</option>
            <option value="grouped">Grouped (manual)</option>
          </select>
        </div>
      </div>

      {value.view_mode === 'grouped' ? (
        <div className="field">
          <label htmlFor="results-group-keys-filter">Group Keys (comma-separated)</label>
          <input
            id="results-group-keys-filter"
            value={value.group_keys_text}
            onChange={(event) => onChange({ ...value, group_keys_text: event.target.value })}
            placeholder="runtime:ollama|model:mistral|metric:tokens_per_sec"
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}
