import { useState } from 'react';

import { CompareRuns } from './pages/CompareRuns';
import { Models } from './pages/Models';
import { RunSingle } from './pages/RunSingle';
import { Targets } from './pages/Targets';

type View = 'targets' | 'run-single' | 'models' | 'compare';

export function App() {
  const [view, setView] = useState<View>('targets');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">AITestBench</p>
          <h1>LLM Test Harness Dashboard</h1>
          <p className="subhead">Local-first target control and test execution.</p>
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
