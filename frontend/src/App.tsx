import { useEffect, useState } from 'react';

import { CompareRuns } from './pages/CompareRuns.js';
import { Models } from './pages/Models.js';
import { RunSingle } from './pages/RunSingle.js';
import { Templates } from './pages/Templates.js';
import { InferenceServers } from './pages/InferenceServers.js';
import { apiGet } from './services/api.js';
import { InferenceServerRecord, listInferenceServers } from './services/inference-servers-api.js';
import { InferenceServerHealth, getConnectivityConfig, getInferenceServerHealth } from './services/connectivity-api.js';
import { EnvEntry, clearDatabase, listEnvEntries, setEnvEntry } from './services/system-api.js';

type View = 'servers' | 'run-single' | 'templates' | 'models' | 'compare';

type SystemMetrics = {
  cpu: {
    usage_percent: number | null;
    cores: number;
    load_1m: number;
    load_5m: number;
    load_15m: number;
  };
  memory: {
    total_bytes: number;
    free_bytes: number;
    used_bytes: number;
    used_percent: number;
  };
  gpu: {
    available: boolean;
    utilization_percent: number | null;
    memory_used_mb: number | null;
    memory_total_mb: number | null;
  };
  db: {
    ok: boolean;
  };
};

type LlmParams = Record<string, unknown> | null;
const PARAM_OVERRIDES_KEY = 'aitestbench:param-overrides';

function formatBytes(value: number): string {
  if (value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / Math.pow(1024, index);
  return `${scaled.toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

function pickParamValue(params: LlmParams, keys: string[]): unknown {
  if (!params) {
    return null;
  }
  for (const key of keys) {
    const value = params[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

function formatNumericParam(value: unknown, digits = 2): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fixed = value.toFixed(digits);
    return digits > 0 ? fixed.replace(/\.0+$/, '') : fixed;
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return value;
  }
  return 'N/A';
}

export function App() {
  const [view, setView] = useState<View>('servers');
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'up' | 'down'>('unknown');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [railPinned, setRailPinned] = useState(true);
  const [railVisible, setRailVisible] = useState(true);
  const [paramOverrides, setParamOverrides] = useState<Record<string, unknown> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsEntries, setSettingsEntries] = useState<EnvEntry[]>([]);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');
  const [servers, setServers] = useState<InferenceServerRecord[]>([]);
  const [serversError, setServersError] = useState(false);
  const [connectivity, setConnectivity] = useState<Record<string, InferenceServerHealth>>({});

  useEffect(() => {
    let isActive = true;
    const checkHealth = async () => {
      try {
        await apiGet<{ status: string }>('/health');
        if (isActive) {
          setHealthStatus('up');
        }
      } catch {
        if (isActive) {
          setHealthStatus('down');
        }
      }
    };

    checkHealth();
    const intervalId = window.setInterval(checkHealth, 15000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const loadOverrides = () => {
      const raw = localStorage.getItem(PARAM_OVERRIDES_KEY);
      if (!raw) {
        setParamOverrides(null);
        return;
      }
      try {
        setParamOverrides(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        setParamOverrides(null);
      }
    };
    loadOverrides();
    const handleUpdate = () => loadOverrides();
    window.addEventListener('param-overrides:updated', handleUpdate);
    return () => window.removeEventListener('param-overrides:updated', handleUpdate);
  }, []);

  useEffect(() => {
    let isActive = true;
    let intervalId: number | null = null;

    const fetchHealth = async () => {
      try {
        const results = await getInferenceServerHealth();
        if (!isActive) {
          return;
        }
        const nextMap: Record<string, InferenceServerHealth> = {};
        for (const entry of results) {
          nextMap[entry.server_id] = entry;
        }
        setConnectivity(nextMap);
      } catch {
        if (isActive) {
          setConnectivity({});
        }
      }
    };

    const setup = async () => {
      try {
        const config = await getConnectivityConfig();
        const interval = Math.max(1000, config.poll_interval_ms);
        await fetchHealth();
        intervalId = window.setInterval(fetchHealth, interval);
      } catch {
        await fetchHealth();
        intervalId = window.setInterval(fetchHealth, 30000);
      }
    };

    setup();
    return () => {
      isActive = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const fetchServers = async () => {
      try {
        const data = await listInferenceServers();
        if (isActive) {
          setServers(data);
          setServersError(false);
        }
      } catch {
        if (isActive) {
          setServersError(true);
        }
      }
    };

    const handleServersUpdated = () => {
      fetchServers();
    };

    fetchServers();
    const intervalId = window.setInterval(fetchServers, 10000);
    window.addEventListener('inference-servers:updated', handleServersUpdated);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener('inference-servers:updated', handleServersUpdated);
    };
  }, []);

  useEffect(() => {
    if (!showSettings) {
      return;
    }
    setSettingsBusy(true);
    setSettingsError(null);
    listEnvEntries()
      .then((entries) => {
        setSettingsEntries(entries);
        setSettingsMessage(null);
      })
      .catch((err) => setSettingsError(err instanceof Error ? err.message : 'Unable to load env entries'))
      .finally(() => setSettingsBusy(false));
  }, [showSettings]);

  useEffect(() => {
    let isActive = true;
    const fetchMetrics = async () => {
      try {
        const data = await apiGet<SystemMetrics>('/system/metrics');
        if (isActive) {
          setSystemMetrics(data);
          setMetricsError(false);
        }
      } catch {
        if (isActive) {
          setMetricsError(true);
        }
      }
    };

    fetchMetrics();
    const intervalId = window.setInterval(fetchMetrics, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (railPinned) {
      setRailVisible(true);
      return;
    }
    if (!railVisible) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRailVisible(false);
    }, 4000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [railPinned, railVisible]);

  const cpuValue =
    systemMetrics?.cpu.usage_percent != null ? `${systemMetrics.cpu.usage_percent.toFixed(1)}%` : 'N/A';
  const memoryValue = systemMetrics
    ? `${formatBytes(systemMetrics.memory.used_bytes)} / ${formatBytes(systemMetrics.memory.total_bytes)}`
    : 'N/A';
  const memoryPercent =
    systemMetrics?.memory.used_percent != null ? `${systemMetrics.memory.used_percent.toFixed(1)}%` : null;
  const gpuValue =
    systemMetrics?.gpu.available && systemMetrics.gpu.utilization_percent != null
      ? `${systemMetrics.gpu.utilization_percent.toFixed(0)}%`
      : 'N/A';
  const gpuMemoryValue =
    systemMetrics?.gpu.available && systemMetrics.gpu.memory_used_mb != null && systemMetrics.gpu.memory_total_mb != null
      ? `${systemMetrics.gpu.memory_used_mb.toFixed(0)} / ${systemMetrics.gpu.memory_total_mb.toFixed(0)} MB`
      : null;
  const dbStatus = systemMetrics ? (systemMetrics.db.ok ? 'up' : 'down') : 'unknown';
  const llmParams = paramOverrides ?? null;
  const temperatureValue = formatNumericParam(
    pickParamValue(paramOverrides ?? llmParams, ['temperature', 'temp']),
    2
  );
  const topPValue = formatNumericParam(
    pickParamValue(paramOverrides ?? llmParams, ['top_p', 'topP']),
    2
  );
  const topKValue = formatNumericParam(
    pickParamValue(paramOverrides ?? llmParams, ['top_k', 'topK']),
    0
  );
  const contextWindowValue = formatNumericParam(
    pickParamValue(paramOverrides ?? llmParams, [
      'context_window',
      'context_window_tokens',
      'max_context_tokens',
      'context_length'
    ]),
    0
  );
  const streamValue = (() => {
    const value = pickParamValue(paramOverrides ?? llmParams, ['stream']);
    if (typeof value === 'boolean') {
      return value ? 'On' : 'Off';
    }
    return 'N/A';
  })();

  async function handleClearDb() {
    const confirmed = window.confirm('Clear all database tables? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    setSettingsBusy(true);
    setSettingsError(null);
    try {
      await clearDatabase();
      setSettingsMessage('Database cleared.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Unable to clear database');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function handleSaveEnvEntry(key: string, value: string | null) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return;
    }
    setSettingsBusy(true);
    setSettingsError(null);
    try {
      const entries = await setEnvEntry(trimmedKey, value);
      setSettingsEntries(entries);
      setSettingsMessage(`${value === null ? 'Removed' : 'Saved'} ${trimmedKey}.`);
      if (trimmedKey === newEnvKey.trim()) {
        setNewEnvKey('');
        setNewEnvValue('');
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Unable to update env entry');
    } finally {
      setSettingsBusy(false);
    }
  }

  function updateEnvValue(key: string, value: string) {
    setSettingsEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, value } : entry))
    );
  }

  return (
    <div className={`app-shell ${railVisible ? 'rail-visible' : 'rail-hidden'}`}>
      <header className="app-header">
        <div>
          <div className="brand-row">
            <p className="eyebrow">AITestBench</p>
          </div>
        </div>
        <div className="header-metrics">
          <div className="metrics-card">
            <div className="metrics-row">
              <span>CPU</span>
              <strong>{metricsError ? 'Unavailable' : cpuValue}</strong>
            </div>
            <div className="metrics-row">
              <span>Memory</span>
              <strong>
                {metricsError ? 'Unavailable' : memoryValue}
                {!metricsError && memoryPercent ? ` (${memoryPercent})` : ''}
              </strong>
            </div>
            <div className="metrics-row">
              <span>GPU</span>
              <strong>
                {metricsError ? 'Unavailable' : gpuValue}
                {!metricsError && gpuMemoryValue ? ` · ${gpuMemoryValue}` : ''}
              </strong>
            </div>
          </div>
          <div className="metrics-card">
            <div className="header-status">
              <div className={`health-indicator ${healthStatus}`}>
                <span className="health-dot" aria-hidden="true" />
                <span>
                  Backend:{' '}
                  {healthStatus === 'up'
                    ? 'Online'
                    : healthStatus === 'down'
                      ? 'Offline'
                      : 'Checking'}
                </span>
              </div>
              <div className={`health-indicator ${dbStatus}`}>
                <span className="health-dot" aria-hidden="true" />
                <span>
                  DB:{' '}
                  {dbStatus === 'up' ? 'Online' : dbStatus === 'down' ? 'Offline' : 'Checking'}
                </span>
              </div>
            </div>
          </div>
          <div className="metrics-card">
            <div className="param-grid">
              <div className="metrics-row">
                <span>Temperature</span>
                <strong>{temperatureValue}</strong>
              </div>
              <div className="metrics-row">
                <span>Top P</span>
                <strong>{topPValue}</strong>
              </div>
              <div className="metrics-row">
                <span>Top K</span>
                <strong>{topKValue}</strong>
              </div>
              <div className="metrics-row">
                <span>Context Window</span>
                <strong>{contextWindowValue}</strong>
              </div>
              <div className="metrics-row">
                <span>Stream</span>
                <strong>{streamValue}</strong>
              </div>
            </div>
            <p className="status-rail-footnote">
              {paramOverrides ? 'Overrides from Run Single' : 'No overrides set'}
            </p>
          </div>
          <div className="metrics-card">
            {serversError ? (
              <div className="health-indicator failed">
                <span className="health-dot" aria-hidden="true" />
                <span>Servers unavailable</span>
              </div>
            ) : servers.length === 0 ? (
              <div className="health-indicator pending">
                <span className="health-dot" aria-hidden="true" />
                <span>No servers</span>
              </div>
            ) : (
              <div className="header-servers-list">
                {servers.map((server) => {
                  const health = connectivity[server.inference_server.server_id];
                  const statusClass = health ? (health.ok ? 'ok' : 'failed') : 'pending';
                  const responseLabel =
                    health?.response_time_ms != null ? ` (${health.response_time_ms} ms)` : '';
                  return (
                    <div key={server.inference_server.server_id} className={`health-indicator ${statusClass}`}>
                      <span className="health-dot" aria-hidden="true" />
                      <span>{`${server.inference_server.display_name}${responseLabel}`}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="app-body">
        <aside className="app-nav">
          <div className="nav-section">
            <button
              type="button"
              className={view === 'servers' ? 'active' : undefined}
              onClick={() => setView('servers')}
              aria-label="Inference servers"
              title="Inference servers"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4" y="5" width="16" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <rect x="4" y="13" width="16" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button
              type="button"
              className={view === 'models' ? 'active' : undefined}
              onClick={() => setView('models')}
              aria-label="Models"
              title="Models"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 7c0-2 7-4 7-4s7 2 7 4-7 4-7 4-7-2-7-4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M5 12c0 2 7 4 7 4s7-2 7-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M5 17c0 2 7 4 7 4s7-2 7-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
            <button
              type="button"
              className={view === 'templates' ? 'active' : undefined}
              onClick={() => setView('templates')}
              aria-label="Templates"
              title="Templates"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 4h9l3 3v13H6V4z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M9 9h6M9 13h6M9 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              className={view === 'run-single' ? 'active' : undefined}
              onClick={() => setView('run-single')}
              aria-label="Run"
              title="Run"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8 5l11 7-11 7V5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className={view === 'compare' ? 'active' : undefined}
              onClick={() => setView('compare')}
              aria-label="Compare"
              title="Compare"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 7h14M5 12h10M5 17h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="nav-footer">
            <button
              type="button"
              className={showSettings ? 'active' : undefined}
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              title="Settings"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M4 12l2.2-.5a6.9 6.9 0 0 1 1-2L6 7l2-2 2.5 1.2a6.9 6.9 0 0 1 2-.8L12 3h2l.5 2.4a6.9 6.9 0 0 1 2 .8L19 5l2 2-1.2 2.5a6.9 6.9 0 0 1 .8 2L23 12v2l-2.4.5a6.9 6.9 0 0 1-.8 2L21 19l-2 2-2.5-1.2a6.9 6.9 0 0 1-2 .8L14 23h-2l-.5-2.4a6.9 6.9 0 0 1-2-.8L7 21l-2-2 1.2-2.5a6.9 6.9 0 0 1-.8-2L3 14v-2l2.4-.5a6.9 6.9 0 0 1 .8-2L5 7l2-2 2.5 1.2a6.9 6.9 0 0 1 2-.8L12 3h2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </aside>
        <main className="app-main">
          {view === 'servers' ? (
            <InferenceServers />
          ) : view === 'run-single' ? (
            <RunSingle />
          ) : view === 'templates' ? (
            <Templates />
          ) : view === 'models' ? (
            <Models />
          ) : (
            <CompareRuns />
          )}
        </main>
      </div>
      <aside className={`status-rail ${railVisible ? 'is-visible' : 'is-hidden'}`}>
        <div className="status-rail-header">
          <button
            type="button"
            className="rail-toggle"
            onClick={() => {
              setRailPinned((prev) => !prev);
              setRailVisible(true);
            }}
            aria-label={railPinned ? 'Unpin status rail' : 'Pin status rail'}
            title={railPinned ? 'Unpin' : 'Pin'}
          >
            {railPinned ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8 3h8l1 3-3 4v6l-2 2-2-2v-6l-3-4 1-3zM12 18v3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8 3h8l1 3-3 4v2l-2 2-2-2v-2l-3-4 1-3zM5 19l14-14M12 16v5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </aside>
      {showSettings ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card settings-card">
            <div className="modal-header">
              <h3>Settings</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowSettings(false)}
                aria-label="Close"
              >
                <span aria-hidden="true">x</span>
              </button>
            </div>
            {settingsError ? <div className="error">{settingsError}</div> : null}
            {settingsMessage ? <p className="muted">{settingsMessage}</p> : null}
            <div className="settings-section">
              <h4>Database</h4>
              <p className="muted">Clear all tables in the current SQLite database.</p>
              <button type="button" onClick={handleClearDb} disabled={settingsBusy}>
                {settingsBusy ? 'Working…' : 'Empty database'}
              </button>
            </div>
            <div className="divider" />
            <div className="settings-section">
              <h4>Environment (.env)</h4>
              <p className="muted">Changes update the .env file at the app root.</p>
              {settingsEntries.length === 0 ? <p className="muted">No env variables found.</p> : null}
              <div className="env-list">
                {settingsEntries.map((entry) => (
                  <div key={entry.key} className="env-row">
                    <div className="env-key">{entry.key}</div>
                    <input
                      value={entry.value}
                      onChange={(event) => updateEnvValue(entry.key, event.target.value)}
                      disabled={settingsBusy}
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEnvEntry(entry.key, entry.value)}
                      disabled={settingsBusy}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEnvEntry(entry.key, null)}
                      disabled={settingsBusy}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="env-add">
                <input
                  placeholder="ENV_KEY"
                  value={newEnvKey}
                  onChange={(event) => setNewEnvKey(event.target.value)}
                  disabled={settingsBusy}
                />
                <input
                  placeholder="value"
                  value={newEnvValue}
                  onChange={(event) => setNewEnvValue(event.target.value)}
                  disabled={settingsBusy}
                />
                <button
                  type="button"
                  onClick={() => handleSaveEnvEntry(newEnvKey, newEnvValue)}
                  disabled={settingsBusy || !newEnvKey.trim()}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {!railVisible ? (
        <button
          type="button"
          className="status-rail-tab"
          onClick={() => setRailVisible(true)}
        >
          System Rail
        </button>
      ) : null}
    </div>
  );
}
