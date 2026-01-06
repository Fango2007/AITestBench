import { useState } from 'react';

export function CompareRuns() {
  const [filter, setFilter] = useState('');

  return (
    <section className="page">
      <h1>Compare Runs</h1>
      <label>
        Filter
        <input value={filter} onChange={(event) => setFilter(event.target.value)} />
      </label>
      <p>Sweep panel placeholder</p>
    </section>
  );
}
