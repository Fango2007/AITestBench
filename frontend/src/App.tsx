import { useEffect, useState } from 'react';

import { CompareRuns } from './pages/CompareRuns';
import { Models } from './pages/Models';
import { RunSingle } from './pages/RunSingle';
import { Targets } from './pages/Targets';
import { apiGet } from './services/api';

type View = 'targets' | 'run-single' | 'models' | 'compare';

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

function formatBytes(value: number): string {
  if (value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / Math.pow(1024, index);
  return `${scaled.toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

export function App() {
  const [view, setView] = useState<View>('targets');
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'up' | 'down'>('unknown');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [metricsError, setMetricsError] = useState(false);

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-row">
            <p className="eyebrow">AITestBench</p>
          </div>
          <h1>LLM Test Harness Dashboard</h1>
          <p className="subhead">Local-first target control and test execution.</p>
        </div>
        <div className="header-metrics">
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
          <div className="metrics-card">
            <p className="metrics-title">System Metrics</p>
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
      </header>
      <div className="app-body">
        <aside className="app-nav">
          <p className="nav-title">Menu</p>
          <button
            type="button"
            className={view === 'targets' ? 'active' : undefined}
            onClick={() => setView('targets')}
          >
            Targets
          </button>
          <button
            type="button"
            className={view === 'run-single' ? 'active' : undefined}
            onClick={() => setView('run-single')}
          >
            Run Single
          </button>
          <button
            type="button"
            className={view === 'models' ? 'active' : undefined}
            onClick={() => setView('models')}
          >
            Models
          </button>
          <button
            type="button"
            className={view === 'compare' ? 'active' : undefined}
            onClick={() => setView('compare')}
          >
            Compare Runs
          </button>
        </aside>
        <main className="app-main">
          {view === 'targets' ? (
            <Targets />
          ) : view === 'run-single' ? (
            <RunSingle />
          ) : view === 'models' ? (
            <Models />
          ) : (
            <CompareRuns />
          )}
        </main>
      </div>
    </div>
  );
}
