import { useEffect, useState } from 'react';

import { CompareRuns } from './pages/CompareRuns';
import { Models } from './pages/Models';
import { RunSingle } from './pages/RunSingle';
import { TestTemplates } from './pages/TestTemplates';
import { Targets } from './pages/Targets';

type View = 'targets' | 'run-single' | 'models' | 'compare' | 'test-templates';

export function App() {
  const [view, setView] = useState<View>('targets');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const navItems: Array<{ id: View; label: string; icon: string }> = [
    { id: 'targets', label: 'Targets', icon: 'grid' },
    { id: 'test-templates', label: 'Templates', icon: 'document' },
    { id: 'run-single', label: 'Run', icon: 'calendar' },
    { id: 'models', label: 'Models', icon: 'globe' },
    { id: 'compare', label: 'Compare', icon: 'chat' }
  ];
  const activeLabel = navItems.find((item) => item.id === view)?.label ?? 'Dashboard';
  const backendStatusLabel = backendOk === null ? 'Checking' : backendOk ? 'Online' : 'Offline';
  const backendPillClass =
    backendOk === null ? 'pill' : backendOk ? 'pill pill--ok' : 'pill pill--error';

  useEffect(() => {
    let active = true;
    const baseUrl =
      (import.meta.env.VITE_AITESTBENCH_API_BASE_URL as string | undefined)
      ?? 'http://localhost:8080';
    const apiToken = import.meta.env.VITE_AITESTBENCH_API_TOKEN as string | undefined;
    const authHeader = apiToken ? { 'x-api-token': apiToken } : undefined;

    async function checkBackend() {
      try {
        const response = await fetch(`${baseUrl}/health`, {
          headers: authHeader
        });
        if (!active) {
          return;
        }
        setBackendOk(response.ok);
      } catch {
        if (!active) {
          return;
        }
        setBackendOk(false);
      }
    }

    checkBackend();
    const interval = window.setInterval(checkBackend, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="logo-mark" aria-label="AITESTBENCH">
          A
        </div>
        <nav className="nav-stack" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-button ${view === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
              aria-label={item.label}
            >
              <span className={`nav-icon nav-icon--${item.icon}`} aria-hidden="true" />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-footer">
          <button type="button" className="nav-button" aria-label="Settings">
            <span className="nav-icon nav-icon--settings" aria-hidden="true" />
            <span className="nav-label">Settings</span>
          </button>
          <button type="button" className="nav-button" aria-label="Help">
            <span className="nav-icon nav-icon--help" aria-hidden="true" />
            <span className="nav-label">Help</span>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div>
            <div className="brand-row">
              <h1>AITESTBENCH</h1>
              <div className="status-row">
                <span className="status-label">Backend:</span>
                <span
                  className={`status-dot ${
                    backendOk === null ? 'status-dot--pending' : backendOk ? 'status-dot--ok' : 'status-dot--error'
                  }`}
                  aria-label={
                    backendOk === null ? 'Checking backend' : backendOk ? 'Backend online' : 'Backend offline'
                  }
                />
              </div>
            </div>
            <p className="subhead">Local-first target control and test execution.</p>
          </div>
        </header>
        <div className="app-content">
          <main className="app-workspace">
            {view === 'targets' ? (
              <Targets />
            ) : view === 'test-templates' ? (
              <TestTemplates />
            ) : view === 'run-single' ? (
              <RunSingle />
            ) : view === 'models' ? (
              <Models />
            ) : (
              <CompareRuns />
            )}
          </main>
          <aside className="app-panel">
            <div className="panel-card">
              <p className="panel-eyebrow">Active View</p>
              <h2>{activeLabel}</h2>
              <p className="muted">Use the left rail to switch workflows.</p>
            </div>
            <div className="panel-card">
              <p className="panel-eyebrow">Backend</p>
              <div className="panel-row">
                <span>Status</span>
                <span className={backendPillClass}>{backendStatusLabel}</span>
              </div>
              <p className="muted">Health checks run every 15 seconds.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
