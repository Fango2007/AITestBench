import { useEffect, useState } from 'react';

import { CompareRuns } from './pages/CompareRuns.js';
import { Models } from './pages/Models.js';
import { RunSingle } from './pages/RunSingle.js';
import { Templates } from './pages/Templates.js';
import { Targets } from './pages/Targets.js';
import { apiGet } from './services/api.js';
import { TargetRecord, listTargets } from './services/targets-api.js';

type View = 'targets' | 'run-single' | 'templates' | 'models' | 'compare';

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
  const [view, setView] = useState<View>('targets');
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'up' | 'down'>('unknown');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [metricsError, setMetricsError] = useState(false);
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [targetsError, setTargetsError] = useState(false);
  const [railPinned, setRailPinned] = useState(true);
  const [railVisible, setRailVisible] = useState(true);
  const [paramOverrides, setParamOverrides] = useState<Record<string, unknown> | null>(null);

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
    let isActive = true;
    const fetchTargets = async () => {
      try {
        const data = await listTargets('all');
        if (isActive) {
          setTargets(data);
          setTargetsError(false);
        }
      } catch {
        if (isActive) {
          setTargetsError(true);
        }
      }
    };

    const handleTargetsUpdated = () => {
      fetchTargets();
    };

    fetchTargets();
    const intervalId = window.setInterval(fetchTargets, 10000);
    window.addEventListener('targets:updated', handleTargetsUpdated);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      window.removeEventListener('targets:updated', handleTargetsUpdated);
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
  const activeTargets = targets.filter((target) => target.status === 'active');
  const targetOkCount = activeTargets.filter((target) => target.connectivity_status === 'ok').length;
  const targetFailedCount = activeTargets.filter((target) => target.connectivity_status === 'failed').length;
  const targetPendingCount = activeTargets.filter((target) => target.connectivity_status === 'pending').length;
  const targetsStatus = targetsError
    ? 'down'
    : activeTargets.length === 0
      ? 'unknown'
      : targetFailedCount > 0
        ? 'down'
        : targetPendingCount > 0
          ? 'unknown'
          : 'up';
  const targetStatusLabel = (status: TargetRecord['connectivity_status']) => {
    if (status === 'ok') {
      return { ok: 1, pending: 0, failed: 0 };
    }
    if (status === 'failed') {
      return { ok: 0, pending: 0, failed: 1 };
    }
    return { ok: 0, pending: 1, failed: 0 };
  };
  const targetStatusClass = (status: TargetRecord['connectivity_status']) => {
    if (status === 'ok') {
      return 'up';
    }
    if (status === 'failed') {
      return 'down';
    }
    return 'unknown';
  };
  const targetParamSource = activeTargets.find(
    (target) => target.default_params && Object.keys(target.default_params).length > 0
  );
  const llmParams = targetParamSource?.default_params ?? null;
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

  return (
    <div className={`app-shell ${railVisible ? 'rail-visible' : 'rail-hidden'}`}>
      <header className="app-header">
        <div>
          <div className="brand-row">
            <p className="eyebrow">AITestBench</p>
          </div>
        </div>
      </header>
      <div className="app-body">
        <aside className="app-nav">
          <button
            type="button"
            className={view === 'targets' ? 'active' : undefined}
            onClick={() => setView('targets')}
            aria-label="Targets"
            title="Targets"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="4" y="13" width="16" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
        </aside>
        <main className="app-main">
          {view === 'targets' ? (
            <Targets />
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
        <div className="status-rail-section">
          <p className="status-rail-section-title">System Metrics</p>
          <div className="rail-card">
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
        </div>
        <div className="status-rail-section">
          <p className="status-rail-section-title">App Status</p>
          <div className="rail-card">
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
        <div className="status-rail-section">
          <p className="status-rail-section-title">Inferencer Servers</p>
          <div className="rail-card">
            {targetsError ? (
              <div className={`health-indicator ${targetsStatus}`}>
                <span className="health-dot" aria-hidden="true" />
                <span>Targets: Unavailable</span>
              </div>
            ) : activeTargets.length === 0 ? (
              <div className={`health-indicator ${targetsStatus}`}>
                <span className="health-dot" aria-hidden="true" />
                <span>Targets: None</span>
              </div>
            ) : (
              activeTargets.map((target) => {
                const counts = targetStatusLabel(target.connectivity_status);
                return (
                  <div key={target.id} className={`health-indicator ${targetStatusClass(target.connectivity_status)}`}>
                    <span className="health-dot" aria-hidden="true" />
                    <span>
                      {target.name}: {counts.ok} ok · {counts.pending} pending · {counts.failed} failed
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="status-rail-section">
          <p className="status-rail-section-title">LLM Parameters</p>
          <div className="rail-card">
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
            <p className="status-rail-footnote">
              {paramOverrides
                ? 'Overrides from Run Single'
                : targetParamSource
                  ? `Defaults from ${targetParamSource.name}`
                  : 'No target defaults found'}
            </p>
          </div>
        </div>
      </aside>
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
