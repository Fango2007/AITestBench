import { useEffect, useState } from 'react';

import { apiGet } from '../services/api.js';

export function RunHistory() {
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    apiGet<Record<string, unknown>[]>('/runs').then(setRuns).catch(() => setRuns([]));
  }, []);

  return (
    <section className="page">
      <h1>Run History</h1>
      <ul>
        {runs.map((run, index) => (
          <li key={index}>{JSON.stringify(run)}</li>
        ))}
      </ul>
    </section>
  );
}
