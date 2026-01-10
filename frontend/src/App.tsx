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
      <header className="app-header">
        <div>
          <p className="eyebrow">AITestBench</p>
          <h1>AITESTBENCH</h1>
          <p className="subhead">Local-first target control and test execution.</p>
        </div>
        <div className="status-row">
          <span className="status-label">Backend:</span>
          <span
            className={`status-dot ${
              backendOk === null ? 'status-dot--pending' : backendOk ? 'status-dot--ok' : 'status-dot--error'
            }`}
            aria-label={backendOk === null ? 'Checking backend' : backendOk ? 'Backend online' : 'Backend offline'}
          />
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
            className={view === 'test-templates' ? 'active' : undefined}
            onClick={() => setView('test-templates')}
          >
            Test Templates
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
      </div>
    </div>
  );
}
