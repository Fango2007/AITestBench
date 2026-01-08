import { useEffect, useState } from 'react';

import { apiGet } from '../services/api';

export function Results() {
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [parameters, setParameters] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    apiGet<Record<string, unknown>[]>('/runs/example/results')
      .then(setResults)
      .catch(() => setResults([]));
    apiGet<Record<string, unknown>>('/runs/example')
      .then((run) => {
        const snapshot = run.environment_snapshot as Record<string, unknown> | undefined;
        setParameters((snapshot?.effective_config as Record<string, unknown>) ?? null);
      })
      .catch(() => setParameters(null));
  }, []);

  return (
    <section className="page">
      <h1>Results</h1>
      {parameters ? (
        <section>
          <h2>Parameters</h2>
          <pre>{JSON.stringify(parameters, null, 2)}</pre>
        </section>
      ) : null}
      <ul>
        {results.map((result, index) => (
          <li key={index}>
            {'failure_reason' in result && result.failure_reason ? (
              <p>Failure: {String(result.failure_reason)}</p>
            ) : null}
            {'metrics' in result && result.metrics ? (
              <p>Perplexity: {String((result.metrics as Record<string, unknown>).proxy_accuracy ?? '')}</p>
            ) : null}
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
