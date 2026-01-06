import { useEffect, useState } from 'react';

import { apiGet } from '../services/api';

interface Target {
  id: string;
  name: string;
  base_url: string;
}

export function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);

  useEffect(() => {
    apiGet<Target[]>('/targets').then(setTargets).catch(() => setTargets([]));
  }, []);

  return (
    <section className="page">
      <h1>Targets</h1>
      <ul>
        {targets.map((target) => (
          <li key={target.id}>{target.name}</li>
        ))}
      </ul>
    </section>
  );
}
